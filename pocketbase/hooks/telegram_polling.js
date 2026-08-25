// telegram_polling.js - Cron job and endpoints for Telegram getUpdates Polling
// Runs every 10 seconds to poll updates from Telegram bot API

cronAdd('telegram_polling', '*/10 * * * * *', () => {
  const botToken =
    $os.getenv('TELEGRAM_BOT_TOKEN') || '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
  if (!botToken) {
    console.log('[Telegram Polling] Bot token not configured')
    return
  }

  try {
    // 1. Get current last_update_id from telegram_state or fallback to telegram_messages max
    let lastUpdateId = 0
    let stateRecord = null

    try {
      stateRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
      lastUpdateId = stateRecord ? Number(stateRecord.get('value')) || 0 : 0
    } catch (_) {
      // If state record missing, check if we can get max update_id from telegram_messages
      try {
        const lastMsgs = $app.findRecordsByFilter(
          'telegram_messages',
          'update_id > 0',
          '-update_id',
          1,
          0,
        )
        if (lastMsgs && lastMsgs.length > 0) {
          lastUpdateId = Number(lastMsgs[0].get('update_id')) || 0
        }
      } catch (_) {}
    }

    const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
    const url =
      'https://api.telegram.org/bot' +
      botToken +
      '/getUpdates?offset=' +
      nextOffset +
      '&timeout=5&limit=20'

    console.log('[Telegram Polling] Polling updates with offset:', nextOffset)

    const res = $http.send({
      url: url,
      method: 'GET',
      timeout: 10,
    })

    if (res.statusCode !== 200) {
      console.log('[Telegram Polling] Telegram API returned status:', res.statusCode, res.raw)
      return
    }

    const data = res.json
    if (!data || !data.ok || !Array.isArray(data.result)) {
      console.log('[Telegram Polling] Unexpected response structure from Telegram')
      return
    }

    const updates = data.result
    if (updates.length === 0) {
      // Update last poll timestamp in state
      try {
        let lastPollRecord = null
        try {
          lastPollRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_poll_at')
        } catch (_) {}

        if (lastPollRecord) {
          lastPollRecord.set('text_value', new Date().toISOString())
          $app.save(lastPollRecord)
        } else {
          const stateCol = $app.findCollectionByNameOrId('telegram_state')
          const rec = new Record(stateCol)
          rec.set('key', 'last_poll_at')
          rec.set('text_value', new Date().toISOString())
          $app.save(rec)
        }
      } catch (_) {}
      return
    }

    console.log('[Telegram Polling] Received ' + updates.length + ' updates')

    let maxProcessedUpdateId = lastUpdateId
    const telegramMessagesCol = $app.findCollectionByNameOrId('telegram_messages')

    for (let i = 0; i < updates.length; i++) {
      const u = updates[i]
      const uId = Number(u.update_id) || 0

      if (uId > maxProcessedUpdateId) {
        maxProcessedUpdateId = uId
      }

      const msg = u.message || u.edited_message || u.channel_post
      if (!msg) {
        continue
      }

      const chatId = msg.chat && msg.chat.id ? Number(msg.chat.id) : 0
      const messageText = msg.text || ''
      const caption = msg.caption || ''

      let fileId = ''
      let fileType = 'text'

      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1]
        fileId = largestPhoto.file_id || ''
        fileType = 'photo'
      } else if (msg.document) {
        fileId = msg.document.file_id || ''
        fileType = 'document'
      }

      // Check if message with this update_id is already inserted to avoid duplicate
      let alreadyExists = false
      try {
        const existing = $app.findFirstRecordByData('telegram_messages', 'update_id', uId)
        if (existing) {
          alreadyExists = true
        }
      } catch (_) {}

      if (!alreadyExists) {
        const newMsgRecord = new Record(telegramMessagesCol)
        newMsgRecord.set('update_id', uId)
        newMsgRecord.set('chat_id', chatId)
        newMsgRecord.set('message_text', messageText)
        newMsgRecord.set('caption', caption)
        newMsgRecord.set('file_id', fileId)
        newMsgRecord.set('file_type', fileType)
        newMsgRecord.set('raw_payload', u)
        newMsgRecord.set('processed', false)

        // Saving triggers the onRecordCreate hook in migration 0018 to categorize & create transaction
        $app.save(newMsgRecord)
        console.log('[Telegram Polling] Saved update_id: ' + uId + ' from chat: ' + chatId)
      }
    }

    // Save updated last_update_id
    if (maxProcessedUpdateId > lastUpdateId) {
      if (stateRecord) {
        stateRecord.set('value', maxProcessedUpdateId)
        $app.save(stateRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_update_id')
        rec.set('value', maxProcessedUpdateId)
        $app.save(rec)
      }
      console.log('[Telegram Polling] Advanced last_update_id to:', maxProcessedUpdateId)
    }

    // Update last poll time
    try {
      let lastPollRecord = null
      try {
        lastPollRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_poll_at')
      } catch (_) {}

      if (lastPollRecord) {
        lastPollRecord.set('text_value', new Date().toISOString())
        $app.save(lastPollRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_poll_at')
        rec.set('text_value', new Date().toISOString())
        $app.save(rec)
      }
    } catch (_) {}
  } catch (err) {
    console.log('[Telegram Polling] Error during polling iteration:', err)
  }
})

// Custom endpoint to trigger immediate manual polling or inspect status
routerAdd('POST', '/api/custom/telegram/poll-now', (e) => {
  const botToken =
    $os.getenv('TELEGRAM_BOT_TOKEN') || '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'

  try {
    let lastUpdateId = 0
    let stateRecord = null

    try {
      stateRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
      lastUpdateId = stateRecord ? Number(stateRecord.get('value')) || 0 : 0
    } catch (_) {}

    const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
    const url =
      'https://api.telegram.org/bot' +
      botToken +
      '/getUpdates?offset=' +
      nextOffset +
      '&timeout=2&limit=20'

    const res = $http.send({
      url: url,
      method: 'GET',
      timeout: 8,
    })

    if (res.statusCode !== 200) {
      return e.json(502, {
        ok: false,
        error: 'Telegram API returned status ' + res.statusCode,
        raw: res.raw,
      })
    }

    const data = res.json
    const updates = (data && data.result) || []
    let processedCount = 0
    let maxProcessedUpdateId = lastUpdateId
    const telegramMessagesCol = $app.findCollectionByNameOrId('telegram_messages')

    for (let i = 0; i < updates.length; i++) {
      const u = updates[i]
      const uId = Number(u.update_id) || 0
      if (uId > maxProcessedUpdateId) {
        maxProcessedUpdateId = uId
      }

      const msg = u.message || u.edited_message || u.channel_post
      if (!msg) continue

      const chatId = msg.chat && msg.chat.id ? Number(msg.chat.id) : 0
      const messageText = msg.text || ''
      const caption = msg.caption || ''

      let fileId = ''
      let fileType = 'text'

      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1]
        fileId = largestPhoto.file_id || ''
        fileType = 'photo'
      } else if (msg.document) {
        fileId = msg.document.file_id || ''
        fileType = 'document'
      }

      let alreadyExists = false
      try {
        const existing = $app.findFirstRecordByData('telegram_messages', 'update_id', uId)
        if (existing) alreadyExists = true
      } catch (_) {}

      if (!alreadyExists) {
        const newMsgRecord = new Record(telegramMessagesCol)
        newMsgRecord.set('update_id', uId)
        newMsgRecord.set('chat_id', chatId)
        newMsgRecord.set('message_text', messageText)
        newMsgRecord.set('caption', caption)
        newMsgRecord.set('file_id', fileId)
        newMsgRecord.set('file_type', fileType)
        newMsgRecord.set('raw_payload', u)
        newMsgRecord.set('processed', false)

        $app.save(newMsgRecord)
        processedCount++
      }
    }

    if (maxProcessedUpdateId > lastUpdateId) {
      if (stateRecord) {
        stateRecord.set('value', maxProcessedUpdateId)
        $app.save(stateRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_update_id')
        rec.set('value', maxProcessedUpdateId)
        $app.save(rec)
      }
    }

    // Update poll timestamp
    try {
      let lastPollRecord = null
      try {
        lastPollRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_poll_at')
      } catch (_) {}

      if (lastPollRecord) {
        lastPollRecord.set('text_value', new Date().toISOString())
        $app.save(lastPollRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_poll_at')
        rec.set('text_value', new Date().toISOString())
        $app.save(rec)
      }
    } catch (_) {}

    return e.json(200, {
      ok: true,
      processedCount: processedCount,
      updatesFound: updates.length,
      lastUpdateId: maxProcessedUpdateId,
    })
  } catch (err) {
    return e.json(500, {
      ok: false,
      error: err.message || String(err),
    })
  }
})

// Custom endpoint to get polling status and info
routerAdd('GET', '/api/custom/telegram/polling-status', (e) => {
  let lastUpdateId = 0
  let lastPollAt = ''
  let messageCount = 0

  try {
    const rec = $app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
    if (rec) lastUpdateId = Number(rec.get('value')) || 0
  } catch (_) {}

  try {
    const rec = $app.findFirstRecordByData('telegram_state', 'key', 'last_poll_at')
    if (rec) lastPollAt = rec.getString('text_value') || ''
  } catch (_) {}

  try {
    messageCount = $app.countRecords('telegram_messages')
  } catch (_) {}

  return e.json(200, {
    ok: true,
    polling_enabled: true,
    interval_seconds: 10,
    last_update_id: lastUpdateId,
    last_poll_at: lastPollAt,
    total_messages: messageCount,
  })
})

migrate(
  (app) => {
    // 1. Ensure telegram_messages createRule allows anonymous/public inserts
    const telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')
    telegramMessagesCol.createRule = '1=1'
    telegramMessagesCol.listRule = ''
    telegramMessagesCol.viewRule = ''
    telegramMessagesCol.updateRule = "@request.auth.id != ''"
    telegramMessagesCol.deleteRule = "@request.auth.id != ''"
    app.save(telegramMessagesCol)

    // 2. Create telegram_state collection if not exists
    let telegramStateCol
    try {
      telegramStateCol = app.findCollectionByNameOrId('telegram_state')
    } catch (_) {
      telegramStateCol = new Collection({
        name: 'telegram_state',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'key', type: 'text', required: true },
          { name: 'value', type: 'number' },
          { name: 'text_value', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_telegram_state_key ON telegram_state (key)'],
      })
      app.save(telegramStateCol)
    }

    // Seed initial offset row if not exists
    try {
      app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
    } catch (_) {
      try {
        const record = new Record(telegramStateCol)
        record.set('key', 'last_update_id')
        record.set('value', 0)
        app.save(record)
      } catch (_) {}
    }

    // 3. Delete Telegram Webhook once via $http.send to enable getUpdates polling
    const botToken = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
    if (typeof $http !== 'undefined' && $http && $http.send) {
      try {
        const delRes = $http.send({
          url: 'https://api.telegram.org/bot' + botToken + '/deleteWebhook',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drop_pending_updates: false }),
          timeout: 10,
        })
        console.log('[Telegram Migration] deleteWebhook status:', delRes.statusCode, delRes.raw)
      } catch (delErr) {
        console.log('[Telegram Migration] deleteWebhook error (non-fatal):', delErr)
      }
    }

    // 4. Register cron job for Telegram Polling (runs every minute: '* * * * *')
    // PocketBase cron parser requires standard 5 segments or macros (@every 10s or * * * * *)
    try {
      if (app.cron && typeof app.cron === 'function') {
        const cronRunner = app.cron()
        if (cronRunner && typeof cronRunner.mustAdd === 'function') {
          // Use '* * * * *' (5 segments standard cron) or '@every 10s' if supported
          // Let's use '* * * * *' to be 100% compliant with standard 5-segment cron format
          cronRunner.mustAdd('telegram_polling', '* * * * *', () => {
            const token = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
            console.log('[Telegram Polling] Starting polling iteration...')

            try {
              // 1. Fetch last_update_id from telegram_state
              let lastUpdateId = 0
              let stateRecord = null
              try {
                stateRecord = app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
                if (stateRecord) {
                  lastUpdateId = Number(stateRecord.get('value')) || 0
                }
              } catch (_) {
                try {
                  const msgs = app.findRecordsByFilter(
                    'telegram_messages',
                    'update_id > 0',
                    '-update_id',
                    1,
                    0,
                  )
                  if (msgs && msgs.length > 0) {
                    lastUpdateId = Number(msgs[0].get('update_id')) || 0
                  }
                } catch (_) {}
              }

              const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
              const getUpdatesUrl =
                'https://api.telegram.org/bot' +
                token +
                '/getUpdates?offset=' +
                nextOffset +
                '&timeout=5&limit=20'

              console.log('[Telegram Polling] Querying offset:', nextOffset)

              if (typeof $http === 'undefined' || !$http || !$http.send) {
                console.log('[Telegram Polling] $http is not available in cron context')
                return
              }

              const res = $http.send({
                url: getUpdatesUrl,
                method: 'GET',
                timeout: 10,
              })

              if (res.statusCode !== 200) {
                console.log('[Telegram Polling] Telegram API HTTP ' + res.statusCode + ':', res.raw)
                return
              }

              const data = res.json
              if (!data || !data.ok || !Array.isArray(data.result)) {
                console.log('[Telegram Polling] Invalid JSON structure from Telegram')
                return
              }

              const updates = data.result
              console.log('[Telegram Polling] Received ' + updates.length + ' update(s)')

              // Always update last_poll_at timestamp
              try {
                let lastPollRecord = null
                try {
                  lastPollRecord = app.findFirstRecordByData(
                    'telegram_state',
                    'key',
                    'last_poll_at',
                  )
                } catch (_) {}

                if (lastPollRecord) {
                  lastPollRecord.set('text_value', new Date().toISOString())
                  app.save(lastPollRecord)
                } else {
                  const stateCol = app.findCollectionByNameOrId('telegram_state')
                  const rec = new Record(stateCol)
                  rec.set('key', 'last_poll_at')
                  rec.set('text_value', new Date().toISOString())
                  app.save(rec)
                }
              } catch (pollTimeErr) {
                console.log('[Telegram Polling] Could not update last_poll_at:', pollTimeErr)
              }

              if (updates.length === 0) {
                return
              }

              let maxProcessedUpdateId = lastUpdateId
              const telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')

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

                // Check if message with this update_id is already inserted
                let alreadyExists = false
                try {
                  const existing = app.findFirstRecordByData('telegram_messages', 'update_id', uId)
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

                  // app.save triggers onRecordCreate hook in migration 0018
                  app.save(newMsgRecord)
                  console.log(
                    '[Telegram Polling] Ingested update_id ' + uId + ' from chat ' + chatId,
                  )
                }
              }

              // Update last_update_id in telegram_state
              if (maxProcessedUpdateId > lastUpdateId) {
                if (stateRecord) {
                  stateRecord.set('value', maxProcessedUpdateId)
                  app.save(stateRecord)
                } else {
                  const stateCol = app.findCollectionByNameOrId('telegram_state')
                  const rec = new Record(stateCol)
                  rec.set('key', 'last_update_id')
                  rec.set('value', maxProcessedUpdateId)
                  app.save(rec)
                }
                console.log('[Telegram Polling] Advanced last_update_id to ' + maxProcessedUpdateId)
              }
            } catch (cronErr) {
              console.log('[Telegram Polling] Error during polling iteration:', cronErr)
            }
          })
          console.log(
            '[Telegram Migration] telegram_polling cron registered via app.cron().mustAdd',
          )
        }
      }
    } catch (cronRegErr) {
      console.log('[Telegram Migration] Error registering cron:', cronRegErr)
    }
  },
  (app) => {
    try {
      if (app.cron && typeof app.cron === 'function') {
        const cronRunner = app.cron()
        if (cronRunner && typeof cronRunner.remove === 'function') {
          cronRunner.remove('telegram_polling')
        }
      }
      const telegramStateCol = app.findCollectionByNameOrId('telegram_state')
      app.delete(telegramStateCol)
    } catch (_) {}
  },
)

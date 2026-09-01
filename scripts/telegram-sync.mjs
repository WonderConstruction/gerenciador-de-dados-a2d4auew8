import PocketBase from 'pocketbase'

/**
 * Telegram Sync Script for GitHub Actions / Scheduled Execution
 *
 * Connects to PocketBase, fetches last_update_id from `telegram_state`,
 * pulls latest updates from Telegram Bot API via getUpdates,
 * creates records in `telegram_messages` (which fires the onRecordCreate hook for automatic transaction creation),
 * and advances `last_update_id` and `last_poll_at` in `telegram_state`.
 */

const DEFAULT_BOT_TOKEN = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
const DEFAULT_PB_URL = 'https://gerenciador-de-dados-e1ffa.goskip.app'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN
const POCKETBASE_URL =
  process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_URL || DEFAULT_PB_URL
const PB_AUTH_EMAIL = process.env.PB_AUTH_EMAIL
const PB_AUTH_PASSWORD = process.env.PB_AUTH_PASSWORD

console.log('--- Telegram Sync 24/7 Polling Script ---')
console.log(`PocketBase URL: ${POCKETBASE_URL}`)
console.log(
  `Bot Token configured: ${TELEGRAM_BOT_TOKEN ? 'YES (Length: ' + TELEGRAM_BOT_TOKEN.length + ')' : 'NO'}`,
)

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[Error] TELEGRAM_BOT_TOKEN is missing.')
  process.exit(1)
}

const pb = new PocketBase(POCKETBASE_URL)
pb.autoCancellation(false)

async function authenticate() {
  if (PB_AUTH_EMAIL && PB_AUTH_PASSWORD) {
    try {
      console.log(`Authenticating PocketBase as ${PB_AUTH_EMAIL}...`)
      await pb.collection('users').authWithPassword(PB_AUTH_EMAIL, PB_AUTH_PASSWORD)
      console.log('[Auth] Authenticated successfully as user.')
    } catch (err) {
      console.warn(
        `[Auth] User authentication failed (${err?.message || err}). Attempting fallback or public access rules...`,
      )
    }
  } else {
    console.log(
      '[Auth] No PB_AUTH_EMAIL/PB_AUTH_PASSWORD provided; proceeding with public access rules.',
    )
  }
}

async function getLastUpdateId() {
  let lastUpdateId = 0
  let stateRecord = null

  try {
    const records = await pb.collection('telegram_state').getList(1, 1, {
      filter: 'key = "last_update_id"',
    })
    if (records.items.length > 0) {
      stateRecord = records.items[0]
      lastUpdateId = Number(stateRecord.value) || 0
      console.log(`[State] Found last_update_id from telegram_state: ${lastUpdateId}`)
    }
  } catch (err) {
    console.warn('[State] Could not fetch telegram_state:', err?.message || err)
  }

  // Fallback: check max update_id from telegram_messages
  if (!stateRecord || lastUpdateId === 0) {
    try {
      const msgs = await pb.collection('telegram_messages').getList(1, 1, {
        filter: 'update_id > 0',
        sort: '-update_id',
      })
      if (msgs.items.length > 0) {
        const maxDbId = Number(msgs.items[0].update_id) || 0
        if (maxDbId > lastUpdateId) {
          lastUpdateId = maxDbId
          console.log(`[State] Discovered max update_id from telegram_messages: ${lastUpdateId}`)
        }
      }
    } catch (err) {
      console.warn(
        '[State] Could not check telegram_messages for max update_id:',
        err?.message || err,
      )
    }
  }

  return { lastUpdateId, stateRecord }
}

async function updateState(stateRecord, newLastUpdateId) {
  try {
    if (stateRecord && stateRecord.id) {
      await pb.collection('telegram_state').update(stateRecord.id, {
        value: newLastUpdateId,
      })
    } else {
      // Check if it was created in the meantime or create new
      try {
        const existing = await pb
          .collection('telegram_state')
          .getFirstListItem('key = "last_update_id"')
        if (existing) {
          await pb.collection('telegram_state').update(existing.id, {
            value: newLastUpdateId,
          })
          return
        }
      } catch (_) {}

      await pb.collection('telegram_state').create({
        key: 'last_update_id',
        value: newLastUpdateId,
      })
    }
    console.log(`[State] Successfully updated last_update_id to ${newLastUpdateId}`)
  } catch (err) {
    console.error('[State] Failed to persist last_update_id:', err?.message || err)
  }
}

async function updateLastPollTime() {
  try {
    const nowIso = new Date().toISOString()
    try {
      const rec = await pb.collection('telegram_state').getFirstListItem('key = "last_poll_at"')
      if (rec) {
        await pb.collection('telegram_state').update(rec.id, {
          text_value: nowIso,
        })
        return
      }
    } catch (_) {}

    await pb.collection('telegram_state').create({
      key: 'last_poll_at',
      text_value: nowIso,
    })
  } catch (err) {
    console.warn('[State] Could not record last_poll_at:', err?.message || err)
  }
}

async function run() {
  try {
    await authenticate()

    const { lastUpdateId, stateRecord } = await getLastUpdateId()
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0

    console.log(`[Telegram API] Requesting getUpdates (offset: ${offset})...`)
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10&limit=50`

    const response = await fetch(telegramUrl)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Telegram API responded HTTP ${response.status} ${response.statusText}: ${errorText}`,
      )
    }

    const data = await response.json()
    if (!data || !data.ok || !Array.isArray(data.result)) {
      throw new Error(`Invalid Telegram response: ${JSON.stringify(data)}`)
    }

    const updates = data.result
    console.log(`[Telegram API] Received ${updates.length} updates.`)

    await updateLastPollTime()

    if (updates.length === 0) {
      console.log('[Telegram Sync] No new messages to process. Everything up to date.')
      return
    }

    let maxUpdateId = lastUpdateId
    let createdCount = 0
    let skippedCount = 0

    for (const update of updates) {
      const updateId = Number(update.update_id) || 0
      if (updateId <= 0) continue

      if (updateId > maxUpdateId) {
        maxUpdateId = updateId
      }

      const msg = update.message || update.edited_message || update.channel_post
      if (!msg) {
        skippedCount++
        continue
      }

      // Check if update_id already exists in telegram_messages
      let alreadyExists = false
      try {
        const existing = await pb.collection('telegram_messages').getList(1, 1, {
          filter: `update_id = ${updateId}`,
        })
        if (existing.totalItems > 0) {
          alreadyExists = true
        }
      } catch (_) {}

      if (alreadyExists) {
        console.log(`[Telegram Sync] Update #${updateId} already exists in DB. Skipping.`)
        skippedCount++
        continue
      }

      const chatId = msg.chat?.id ? Number(msg.chat.id) : 0
      const messageText = msg.text || ''
      const caption = msg.caption || ''
      let fileId = ''
      let fileType = 'text'

      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1]
        fileId = largest.file_id || ''
        fileType = 'photo'
      } else if (msg.document) {
        fileId = msg.document.file_id || ''
        fileType = 'document'
      }

      const payload = {
        update_id: updateId,
        chat_id: chatId,
        message_text: messageText,
        caption: caption,
        file_id: fileId,
        file_type: fileType,
        raw_payload: msg,
        processed: false,
      }

      try {
        await pb.collection('telegram_messages').create(payload)
        createdCount++
        console.log(
          `[Telegram Sync] Inserted telegram_messages record for update #${updateId} (chat: ${chatId})`,
        )
      } catch (err) {
        if (err?.message?.includes('unique') || err?.status === 400) {
          console.log(`[Telegram Sync] Update #${updateId} ignored due to unique rule.`)
          skippedCount++
        } else {
          console.error(`[Telegram Sync] Error inserting update #${updateId}:`, err?.message || err)
        }
      }
    }

    if (maxUpdateId > lastUpdateId) {
      await updateState(stateRecord, maxUpdateId)
    }

    console.log(
      `[Telegram Sync Summary] Processed: ${updates.length} total, ${createdCount} created, ${skippedCount} skipped. New offset: ${maxUpdateId + 1}`,
    )
  } catch (error) {
    console.error('[Telegram Sync Error] Unhandled error during sync:', error)
    process.exit(1)
  }
}

run()

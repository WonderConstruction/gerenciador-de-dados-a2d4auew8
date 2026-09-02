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

// Sanitize inputs
const rawToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN
const TELEGRAM_BOT_TOKEN = rawToken ? rawToken.trim() : ''

let rawPbUrl = process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_URL || DEFAULT_PB_URL
if (rawPbUrl) {
  rawPbUrl = rawPbUrl.trim()
  if (rawPbUrl.endsWith('/')) {
    rawPbUrl = rawPbUrl.slice(0, -1)
  }
}
const POCKETBASE_URL = rawPbUrl

const PB_AUTH_EMAIL = process.env.PB_AUTH_EMAIL ? process.env.PB_AUTH_EMAIL.trim() : ''
const PB_AUTH_PASSWORD = process.env.PB_AUTH_PASSWORD ? process.env.PB_AUTH_PASSWORD.trim() : ''

console.log('====================================================')
console.log('🚀 Telegram Sync 24/7 Polling Script')
console.log('====================================================')
console.log(`[Config] PocketBase URL: ${POCKETBASE_URL}`)
console.log(
  `[Config] Telegram Bot Token: ${
    TELEGRAM_BOT_TOKEN ? 'CONFIGURED (' + TELEGRAM_BOT_TOKEN.slice(0, 8) + '...)' : 'MISSING'
  }`,
)
console.log(
  `[Config] PB Auth Email: ${PB_AUTH_EMAIL ? PB_AUTH_EMAIL : '(None provided - using public API rules)'}`,
)
console.log(
  `[Config] PB Auth Password: ${PB_AUTH_PASSWORD ? 'CONFIGURED (***)' : '(None provided)'}`,
)
console.log('====================================================')

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ [Error] TELEGRAM_BOT_TOKEN is missing. Exiting.')
  process.exit(1)
}

function formatPbError(err) {
  if (!err) return 'Unknown error'
  const status = err.status || err.response?.status || err.statusCode || ''
  const url = err.url || err.response?.url || ''
  let message = err.message || String(err)
  let details = ''

  if (err.data) {
    try {
      details = JSON.stringify(err.data, null, 2)
    } catch (_) {
      details = String(err.data)
    }
  } else if (err.response?.data) {
    try {
      details = JSON.stringify(err.response.data, null, 2)
    } catch (_) {
      details = String(err.response.data)
    }
  }

  const parts = []
  if (status) parts.push(`HTTP ${status}`)
  if (url) parts.push(`URL: ${url}`)
  if (message) parts.push(`Message: ${message}`)
  if (details && details !== '{}') parts.push(`Details: ${details}`)

  return parts.length > 0 ? parts.join(' | ') : message
}

const pb = new PocketBase(POCKETBASE_URL)
pb.autoCancellation(false)

async function authenticate() {
  if (PB_AUTH_EMAIL && PB_AUTH_PASSWORD) {
    try {
      console.log(`🔑 [Auth] Attempting PocketBase authentication as '${PB_AUTH_EMAIL}'...`)
      const authData = await pb
        .collection('users')
        .authWithPassword(PB_AUTH_EMAIL, PB_AUTH_PASSWORD)
      console.log(
        `✅ [Auth] Authenticated successfully! User ID: ${authData?.record?.id || pb.authStore?.record?.id || 'OK'}`,
      )
    } catch (err) {
      console.error(`⚠️ [Auth Error] Authentication failed for ${PB_AUTH_EMAIL}:`)
      console.error(`   ${formatPbError(err)}`)
      console.warn(
        '⚠️ [Auth Warning] Continuing with anonymous/public access rules (the collections allow public read/write).',
      )
    }
  } else {
    console.log(
      'ℹ️ [Auth] No PB_AUTH_EMAIL or PB_AUTH_PASSWORD secret provided. Proceeding with public collection access rules.',
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
    if (records.items && records.items.length > 0) {
      stateRecord = records.items[0]
      lastUpdateId = Number(stateRecord.value) || 0
      console.log(`📌 [State] Found last_update_id from telegram_state: ${lastUpdateId}`)
    } else {
      console.log('📌 [State] No existing telegram_state record for last_update_id.')
    }
  } catch (err) {
    console.warn(`⚠️ [State] Could not fetch telegram_state: ${formatPbError(err)}`)
  }

  // Fallback: check max update_id from telegram_messages
  if (!stateRecord || lastUpdateId === 0) {
    try {
      const msgs = await pb.collection('telegram_messages').getList(1, 1, {
        filter: 'update_id > 0',
        sort: '-update_id',
      })
      if (msgs.items && msgs.items.length > 0) {
        const maxDbId = Number(msgs.items[0].update_id) || 0
        if (maxDbId > lastUpdateId) {
          lastUpdateId = maxDbId
          console.log(`📌 [State] Discovered max update_id from telegram_messages: ${lastUpdateId}`)
        }
      }
    } catch (err) {
      console.warn(
        `⚠️ [State] Could not check telegram_messages for max update_id: ${formatPbError(err)}`,
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
    console.log(`💾 [State] Successfully updated last_update_id to ${newLastUpdateId}`)
  } catch (err) {
    console.error(`⚠️ [State Error] Failed to persist last_update_id: ${formatPbError(err)}`)
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
    console.warn(`⚠️ [State] Could not record last_poll_at: ${formatPbError(err)}`)
  }
}

async function run() {
  try {
    await authenticate()

    const { lastUpdateId, stateRecord } = await getLastUpdateId()
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0

    console.log(`📥 [Telegram API] Requesting getUpdates with offset ${offset}...`)
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10&limit=50`

    let response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000)
      response = await fetch(telegramUrl, { signal: controller.signal })
      clearTimeout(timeoutId)
    } catch (networkErr) {
      throw new Error(`Telegram network request failed: ${networkErr.message || networkErr}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Telegram API returned HTTP ${response.status} ${response.statusText}: ${errorText}`,
      )
    }

    const data = await response.json()
    if (!data || !data.ok || !Array.isArray(data.result)) {
      throw new Error(`Invalid Telegram API response body: ${JSON.stringify(data)}`)
    }

    const updates = data.result
    console.log(`📦 [Telegram API] Received ${updates.length} updates.`)

    await updateLastPollTime()

    if (updates.length === 0) {
      console.log('✨ [Telegram Sync] No new messages to process. All up to date!')
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
        console.log(`⏩ [Telegram Sync] Update #${updateId} already exists in DB. Skipping.`)
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
          `➕ [Telegram Sync] Inserted telegram_messages record for update #${updateId} (chat: ${chatId})`,
        )
      } catch (err) {
        const msgStr = err?.message || ''
        if (msgStr.includes('unique') || err?.status === 400) {
          console.log(
            `⏩ [Telegram Sync] Update #${updateId} ignored due to uniqueness or validation: ${msgStr}`,
          )
          skippedCount++
        } else {
          console.error(
            `⚠️ [Telegram Sync Error] Error inserting update #${updateId}: ${formatPbError(err)}`,
          )
        }
      }
    }

    if (maxUpdateId > lastUpdateId) {
      await updateState(stateRecord, maxUpdateId)
    }

    console.log('====================================================')
    console.log(
      `🎉 [Telegram Sync Summary] Processed: ${updates.length} total, ${createdCount} created, ${skippedCount} skipped. Offset: ${maxUpdateId + 1}`,
    )
    console.log('====================================================')
  } catch (error) {
    console.error('💥 [Telegram Sync Fatal Error] Poller failed with error:')
    console.error(`   ${formatPbError(error)}`)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

run()

/**
 * Telegram Background Poller CLI for GitHub Actions
 *
 * This script runs in GitHub Actions on a schedule (e.g. every 5 minutes).
 * It polls Telegram Bot API via getUpdates, authenticates with PocketBase
 * at the public backend URL, and saves new messages to telegram_messages.
 *
 * On insert, the Skip Cloud hook `telegram_auto_transactions` triggers
 * automatically, parsing text/captions/receipts and generating transactions.
 */

import PocketBase from 'pocketbase'

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'

const POCKETBASE_URL =
  process.env.POCKETBASE_URL ||
  process.env.VITE_POCKETBASE_URL ||
  'https://gerenciador-de-dados-e1ffa.goskip.app'

const PB_AUTH_EMAIL = process.env.PB_AUTH_EMAIL || 'obrunolimaus@gmail.com'
const PB_AUTH_PASSWORD = process.env.PB_AUTH_PASSWORD || 'Skip@Pass'

async function run() {
  console.log('--- Telegram Background Sync via GitHub Actions ---')
  console.log(`Backend URL: ${POCKETBASE_URL}`)
  console.log(`Auth Email: ${PB_AUTH_EMAIL}`)

  const pb = new PocketBase(POCKETBASE_URL)
  pb.autoCancellation(false)

  // 1. Authenticate with PocketBase to ensure valid session
  try {
    console.log('Authenticating with PocketBase...')
    await pb.collection('users').authWithPassword(PB_AUTH_EMAIL, PB_AUTH_PASSWORD)
    console.log(`Authenticated successfully as user: ${pb.authStore.model?.id || 'OK'}`)
  } catch (authErr) {
    console.warn(
      'Notice: Authentication failed or not required for public collections, continuing with anon/current session:',
      authErr?.message || authErr,
    )
  }

  // 2. Query last_update_id from telegram_state or telegram_messages
  let lastUpdateId = 0
  let stateRecordId = ''

  try {
    const stateList = await pb.collection('telegram_state').getFullList({
      filter: 'key = "last_update_id"',
    })
    if (stateList.length > 0) {
      lastUpdateId = Number(stateList[0].value) || 0
      stateRecordId = stateList[0].id
    }
  } catch (stateErr) {
    console.warn(
      'Could not read last_update_id from telegram_state:',
      stateErr?.message || stateErr,
    )
  }

  // Fallback: query highest update_id in telegram_messages if state was 0
  if (lastUpdateId === 0) {
    try {
      const msgList = await pb.collection('telegram_messages').getList(1, 1, {
        sort: '-update_id',
        filter: 'update_id > 0',
      })
      if (msgList.items.length > 0) {
        lastUpdateId = Number(msgList.items[0].update_id) || 0
      }
    } catch (_) {
      /* ignore */
    }
  }

  console.log(
    `Starting Telegram getUpdates with offset: ${lastUpdateId > 0 ? lastUpdateId + 1 : 0}`,
  )

  const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
  const getUpdatesUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${nextOffset}&timeout=10&limit=50`

  const telegramRes = await fetch(getUpdatesUrl)
  if (!telegramRes.ok) {
    const text = await telegramRes.text()
    throw new Error(`Telegram API returned HTTP ${telegramRes.status}: ${text}`)
  }

  const telegramData = await telegramRes.json()
  if (!telegramData || !telegramData.ok || !Array.isArray(telegramData.result)) {
    throw new Error(`Invalid Telegram API response: ${JSON.stringify(telegramData)}`)
  }

  const updates = telegramData.result
  console.log(`Telegram returned ${updates.length} update(s).`)

  let processedCount = 0
  let maxUpdateId = lastUpdateId

  for (const update of updates) {
    const uId = Number(update.update_id) || 0
    if (uId <= 0) continue

    if (uId > maxUpdateId) {
      maxUpdateId = uId
    }

    const msg = update.message || update.edited_message || update.channel_post
    if (!msg) {
      console.log(`Update #${uId} does not contain a message/channel_post payload, skipping.`)
      continue
    }

    // Deduplication check: check if already exists in telegram_messages
    try {
      const existing = await pb.collection('telegram_messages').getList(1, 1, {
        filter: `update_id = ${uId}`,
      })
      if (existing.totalItems > 0) {
        console.log(`Update #${uId} already in DB, skipping.`)
        continue
      }
    } catch (_) {
      /* proceed */
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
      update_id: uId,
      chat_id: chatId,
      message_text: messageText,
      caption: caption,
      file_id: fileId,
      file_type: fileType,
      raw_payload: update,
      processed: false,
    }

    try {
      await pb.collection('telegram_messages').create(payload)
      processedCount++
      console.log(
        `[Success] Ingested update #${uId} from chat ${chatId}: "${(messageText || caption).slice(0, 40)}"`,
      )
    } catch (pbErr) {
      if (pbErr?.message?.includes('unique') || pbErr?.status === 400) {
        console.log(`Duplicate update #${uId} ignored by DB constraint.`)
      } else {
        console.error(`Error saving message #${uId}:`, pbErr?.message || pbErr)
      }
    }
  }

  // Advance last_update_id in telegram_state
  if (maxUpdateId > lastUpdateId) {
    try {
      if (stateRecordId) {
        await pb.collection('telegram_state').update(stateRecordId, {
          value: maxUpdateId,
        })
      } else {
        await pb.collection('telegram_state').create({
          key: 'last_update_id',
          value: maxUpdateId,
        })
      }
      console.log(`Updated last_update_id in telegram_state to ${maxUpdateId}`)
    } catch (saveStateErr) {
      console.warn(
        'Could not update last_update_id in telegram_state:',
        saveStateErr?.message || saveStateErr,
      )
    }
  }

  // Record last_poll_at timestamp
  try {
    const pollList = await pb.collection('telegram_state').getFullList({
      filter: 'key = "last_poll_at"',
    })
    const nowIso = new Date().toISOString()
    if (pollList.length > 0) {
      await pb.collection('telegram_state').update(pollList[0].id, {
        text_value: nowIso,
      })
    } else {
      await pb.collection('telegram_state').create({
        key: 'last_poll_at',
        text_value: nowIso,
      })
    }
    console.log(`Updated last_poll_at in telegram_state to ${nowIso}`)
  } catch (pollErr) {
    console.warn('Could not update last_poll_at in telegram_state:', pollErr?.message || pollErr)
  }

  console.log(`Sync finished! Processed: ${processedCount} new message(s).`)
}

run().catch((err) => {
  console.error('Fatal error in Telegram Poller:', err)
  process.exit(1)
})

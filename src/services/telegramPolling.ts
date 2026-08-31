/**
 * Telegram Polling Service
 *
 * Runs continuous polling in background using Telegram Bot API getUpdates.
 * Persists offset in localStorage to prevent duplicate message handling.
 * Checks existing update_ids in memory and database before creating records.
 */

import pb from '@/lib/pocketbase/client'

const DEFAULT_BOT_TOKEN = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
const STORAGE_OFFSET_KEY = 'telegram_polling_last_offset'
const STORAGE_TOKEN_KEY = 'telegram_bot_token'

export interface TelegramPollingStatus {
  isActive: boolean
  offset: number
  sessionReceivedCount: number
  lastPolledAt: string | null
  lastError: string | null
}

type StatusListener = (status: TelegramPollingStatus) => void

class TelegramPollingService {
  private isRunning = false
  private isPollingInProgress = false
  private currentOffset = 0
  private sessionReceivedCount = 0
  private lastPolledAt: string | null = null
  private lastError: string | null = null
  private listeners: Set<StatusListener> = new Set()
  private abortController: AbortController | null = null
  private pollingTimeoutId: any = null
  private processedUpdateIds: Set<number> = new Set()

  constructor() {
    // Load offset from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedOffset = localStorage.getItem(STORAGE_OFFSET_KEY)
        if (savedOffset) {
          const num = parseInt(savedOffset, 10)
          if (!isNaN(num) && num > 0) {
            this.currentOffset = num
          }
        }
      } catch (err) {
        console.warn('TelegramPolling: Failed to read offset from localStorage', err)
      }
    }
  }

  public getBotToken(): string {
    if (typeof window !== 'undefined') {
      try {
        const customToken = localStorage.getItem(STORAGE_TOKEN_KEY)
        if (customToken && customToken.trim()) {
          return customToken.trim()
        }
      } catch {
        /* ignore */
      }
    }
    return DEFAULT_BOT_TOKEN
  }

  public getStatus(): TelegramPollingStatus {
    return {
      isActive: this.isRunning,
      offset: this.currentOffset,
      sessionReceivedCount: this.sessionReceivedCount,
      lastPolledAt: this.lastPolledAt,
      lastError: this.lastError,
    }
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners() {
    const status = this.getStatus()
    this.listeners.forEach((listener) => {
      try {
        listener(status)
      } catch (err) {
        console.error('TelegramPolling listener error:', err)
      }
    })
  }

  public setOffset(offset: number) {
    if (offset > this.currentOffset) {
      this.currentOffset = offset
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_OFFSET_KEY, String(offset))
        } catch {
          /* ignore */
        }
      }
      this.notifyListeners()
    }
  }

  /**
   * Initializes high-water mark offset from DB before first poll
   */
  private async initOffsetFromDb() {
    try {
      const records = await pb.collection('telegram_messages').getList(1, 1, {
        sort: '-update_id',
        filter: 'update_id > 0',
      })
      if (records.items.length > 0) {
        const maxDbUpdateId = Number(records.items[0].update_id) || 0
        if (maxDbUpdateId >= this.currentOffset) {
          this.setOffset(maxDbUpdateId + 1)
        }
      }
    } catch {
      /* ignore */
    }
  }

  public async start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastError = null
    await this.initOffsetFromDb()
    this.notifyListeners()
    console.log(`[Telegram Polling] Started. Initial offset: ${this.currentOffset}`)
    this.pollLoop()
  }

  public stop() {
    this.isRunning = false
    this.isPollingInProgress = false
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId)
      this.pollingTimeoutId = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.notifyListeners()
    console.log('[Telegram Polling] Stopped.')
  }

  /**
   * Main polling loop. Continues infinitely while isRunning is true.
   */
  private async pollLoop() {
    if (!this.isRunning || this.isPollingInProgress) return

    this.isPollingInProgress = true
    const token = this.getBotToken()
    let delayBeforeNext = 3000 // 3 seconds normal delay

    try {
      this.abortController = new AbortController()
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.currentOffset}&timeout=5`

      const res = await fetch(url, {
        signal: this.abortController.signal,
      })

      if (!res.ok) {
        throw new Error(`Telegram API responded with HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (data && data.ok && Array.isArray(data.result)) {
        this.lastPolledAt = new Date().toISOString()
        this.lastError = null

        const updates: any[] = data.result

        for (const update of updates) {
          const updateId = Number(update.update_id)
          if (isNaN(updateId)) continue

          // Deduplication: skip if already processed in this runtime session
          if (this.processedUpdateIds.has(updateId)) {
            this.setOffset(updateId + 1)
            continue
          }

          // Process and send to PocketBase
          await this.processUpdate(update)

          // Mark in session set
          this.processedUpdateIds.add(updateId)

          // Advance offset so we don't request this update again
          if (updateId >= this.currentOffset) {
            this.setOffset(updateId + 1)
          }
        }
      } else if (data && !data.ok) {
        console.warn('[Telegram Polling] Telegram returned error:', data.description)
        this.lastError = data.description || 'Telegram API returned not OK'
        // If conflict (webhook active), 5s delay
        delayBeforeNext = 6000
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Normal abort on stop, do nothing
        return
      }
      console.warn('[Telegram Polling] Error during polling:', err?.message || err)
      this.lastError = err?.message || 'Polling request failed'
      // Wait 5 seconds on error before retrying
      delayBeforeNext = 5000
    } finally {
      this.abortController = null
      this.isPollingInProgress = false
      this.notifyListeners()

      // Schedule next poll if still running
      if (this.isRunning) {
        this.pollingTimeoutId = setTimeout(() => {
          this.pollLoop()
        }, delayBeforeNext)
      }
    }
  }

  /**
   * For each update with a message, check database and create record in telegram_messages
   */
  private async processUpdate(update: any) {
    try {
      const msg = update.message || update.edited_message || update.channel_post
      if (!msg) {
        return
      }

      const updateId = Number(update.update_id) || 0
      if (updateId <= 0) return

      // Deduplication check: query PocketBase before insert
      try {
        const existing = await pb.collection('telegram_messages').getList(1, 1, {
          filter: `update_id = ${updateId}`,
        })
        if (existing.totalItems > 0) {
          console.log(`[Telegram Polling] Update #${updateId} already exists in DB. Skipping.`)
          this.processedUpdateIds.add(updateId)
          return
        }
      } catch {
        /* proceed to insert */
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
        this.sessionReceivedCount++
        this.processedUpdateIds.add(updateId)
        console.log(`[Telegram Polling] Successfully ingested Telegram update #${updateId}`)
      } catch (pbErr: any) {
        // If failed due to unique constraint, it is an expected duplicate ignore
        if (pbErr?.message?.includes('unique') || pbErr?.status === 400) {
          console.log(
            `[Telegram Polling] Duplicate update #${updateId} rejected by DB unique rule.`,
          )
        } else {
          console.warn('[Telegram Polling] Could not save telegram message:', pbErr)
        }
      }
    } catch (err) {
      console.warn('[Telegram Polling] Error processing message:', err)
    }
  }

  /**
   * Cleans / drops the webhook on Telegram so updates can be fetched via getUpdates
   */
  public async clearWebhook(token?: string): Promise<{ ok: boolean; description?: string }> {
    const cleanToken = (token || this.getBotToken()).trim()
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`,
        {
          method: 'POST',
        },
      )
      const data = await res.json()
      return data
    } catch (err: any) {
      console.warn('[Telegram Polling] Error calling deleteWebhook:', err)
      return { ok: false, description: err?.message || 'Falha ao deletar webhook' }
    }
  }
}

// Global singleton instance
export const telegramPolling = new TelegramPollingService()

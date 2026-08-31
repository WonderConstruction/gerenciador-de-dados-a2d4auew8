import pb from '@/lib/pocketbase/client'
import { Obra, Transaction, CATEGORY_LABELS } from '@/types'
import { appendRowToGoogleSheet, googleServiceAccountConfig } from './googleAuth'

export interface SheetRowData {
  date: string
  category: string
  description: string
  amount: number
  receiptUrl?: string
}

export const googleSheetsService = {
  /**
   * Returns the service account email needed for sharing spreadsheets.
   */
  getServiceAccountEmail(): string {
    return googleServiceAccountConfig.clientEmail
  },

  /**
   * Extracts the Google Spreadsheet ID from a URL or raw ID string.
   */
  extractSpreadsheetId(urlOrId?: string): string | null {
    if (!urlOrId) return null
    const trimmed = urlOrId.trim()
    if (/^[a-zA-Z0-9_-]{30,60}$/.test(trimmed)) {
      return trimmed
    }
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  },

  /**
   * Real sync to Google Sheets via Google Sheets API v4.
   * Authenticates with Service Account and appends a row to the spreadsheet.
   * ONLY marks `sheets_synced: true` if the Google API call succeeds!
   */
  async syncTransactionToSheet(
    transaction: Transaction,
    obra?: Obra | null,
  ): Promise<{ success: boolean; message: string; sheetId?: string; error?: string }> {
    // 1. Locate target obra to obtain spreadsheet ID/URL
    let targetObra = obra
    if (!targetObra && transaction.obra_id) {
      try {
        targetObra = await pb.collection('obras').getOne<Obra>(transaction.obra_id)
      } catch {
        /* intentionally ignored */
      }
    }

    const sheetUrl = targetObra?.google_sheets_url || ''
    const sheetId =
      targetObra?.google_sheets_id ||
      this.extractSpreadsheetId(sheetUrl) ||
      (targetObra?.name?.toLowerCase().includes('720')
        ? '1jaVk5ZXIR3-Woau6dxFrsmINFpV7WkThVVIZJaZV3BU'
        : null)

    if (!sheetId) {
      const msg = `Obra "${targetObra?.name || 'Geral'}" não possui link do Google Sheets configurado.`
      console.warn('[GoogleSheetsService]', msg)
      return {
        success: false,
        message: msg,
        error: msg,
      }
    }

    // Format transaction data: Data, Categoria, Descrição, Valor, [Link do Recibo]
    const dateFormatted = transaction.date
      ? new Date(transaction.date).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR')

    const categoryLabel =
      CATEGORY_LABELS[transaction.category]?.label || transaction.category || 'Materiais'

    const description = transaction.description || transaction.raw_bot_text || 'Lançamento'
    const amountVal = Number(transaction.amount || 0)

    // Optional receipt file URL
    let receiptLink = ''
    if (transaction.receipt_file) {
      receiptLink = `${pb.baseUrl}/api/files/transactions/${transaction.id}/${transaction.receipt_file}`
    }

    const rowValues = [
      dateFormatted,
      categoryLabel,
      description,
      amountVal,
      ...(receiptLink ? [receiptLink] : []),
    ]

    console.log('[GoogleSheetsService] Writing real row to Google Sheet:', {
      sheetId,
      obra: targetObra?.name,
      rowValues,
    })

    try {
      // 2. Real call to Google Sheets API v4
      const result = await appendRowToGoogleSheet(sheetId, rowValues)

      console.log('[GoogleSheetsService] Successfully appended row:', result)

      // 3. ONLY mark `sheets_synced: true` after Google API confirms success
      await pb.collection('transactions').update(transaction.id, {
        sheets_synced: true,
        status: 'reviewed',
      })

      // 4. Update last_sheets_sync timestamp on Obra
      if (targetObra?.id) {
        try {
          await pb.collection('obras').update(targetObra.id, {
            last_sheets_sync: new Date().toISOString(),
            google_sheets_id: sheetId,
          })
        } catch {
          /* ignore */
        }
      }

      return {
        success: true,
        message: `Lançamento de R$ ${amountVal.toFixed(2)} registrado com sucesso na planilha Google Sheets! (Linhas atualizadas: ${result.updatedRows})`,
        sheetId,
      }
    } catch (err: any) {
      console.error('[GoogleSheetsService] Failed to append row to Google Sheets:', err)
      const errorMsg = err?.message || 'Erro desconhecido ao comunicar com o Google Sheets.'

      // DO NOT mark sheets_synced: true on failure!
      return {
        success: false,
        message: errorMsg,
        error: errorMsg,
        sheetId,
      }
    }
  },

  /**
   * Syncs multiple reviewed transactions in bulk to the Google Sheet.
   */
  async syncBatchToSheet(
    transactions: Transaction[],
    obra?: Obra | null,
  ): Promise<{ syncedCount: number; errorsCount: number; lastError?: string }> {
    let syncedCount = 0
    let errorsCount = 0
    let lastError: string | undefined

    for (const tx of transactions) {
      const res = await this.syncTransactionToSheet(tx, obra)
      if (res.success) {
        syncedCount++
      } else {
        errorsCount++
        lastError = res.error || res.message
      }
    }

    return { syncedCount, errorsCount, lastError }
  },
}

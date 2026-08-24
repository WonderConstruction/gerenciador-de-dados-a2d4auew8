import pb from '@/lib/pocketbase/client'
import { Transaction, TransactionCategory, TransactionType } from '@/types'

export const transactionsService = {
  async getAll(filter?: string, sort = '-date'): Promise<Transaction[]> {
    return await pb.collection('transactions').getFullList<Transaction>({
      filter,
      sort,
      expand: 'obra_id',
    })
  },

  async getByObra(obraId: string): Promise<Transaction[]> {
    return await pb.collection('transactions').getFullList<Transaction>({
      filter: `obra_id = "${obraId}"`,
      sort: '-date',
    })
  },

  async create(data: {
    obra_id: string
    type: TransactionType
    amount: number
    category: TransactionCategory
    description: string
    date: string
    receipt_file?: File | null
    source?: 'manual' | 'whatsapp' | 'telegram' | 'import'
    raw_bot_text?: string
    sheets_synced?: boolean
    notes?: string
  }): Promise<Transaction> {
    const user = pb.authStore.model
    const formData = new FormData()

    formData.append('obra_id', data.obra_id)
    if (user?.id) {
      formData.append('user_id', user.id)
    }
    formData.append('type', data.type)
    formData.append('amount', String(data.amount))
    formData.append('category', data.category)
    formData.append('description', data.description)
    formData.append('date', data.date)
    formData.append('source', data.source || 'manual')
    formData.append('sheets_synced', String(!!data.sheets_synced))
    if (data.raw_bot_text) formData.append('raw_bot_text', data.raw_bot_text)
    if (data.notes) formData.append('notes', data.notes)

    if (data.receipt_file) {
      formData.append('receipt_file', data.receipt_file)
    }

    return await pb.collection('transactions').create<Transaction>(formData)
  },

  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    return await pb.collection('transactions').update<Transaction>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('transactions').delete(id)
  },

  getFileUrl(transaction: Transaction, fileName?: string): string {
    const file = fileName || transaction.receipt_file
    if (!file) return ''
    return pb.files.getURL(transaction, file)
  },
}

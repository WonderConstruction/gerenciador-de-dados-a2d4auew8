import pb from '@/lib/pocketbase/client'
import { Obra, Transaction } from '@/types'

export const obrasService = {
  async getAll(): Promise<Obra[]> {
    return await pb.collection('obras').getFullList<Obra>({
      sort: '-created',
    })
  },

  async getById(id: string): Promise<Obra> {
    return await pb.collection('obras').getOne<Obra>(id)
  },

  async getByShareToken(token: string): Promise<Obra | null> {
    try {
      const records = await pb.collection('obras').getList<Obra>(1, 1, {
        filter: `share_token = "${token}"`,
      })
      return records.items[0] || null
    } catch (e) {
      console.error('Error fetching obra by share token:', e)
      return null
    }
  },

  async create(data: Partial<Obra>): Promise<Obra> {
    const user = pb.authStore.model
    const shareToken =
      data.share_token ||
      `obra-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
    return await pb.collection('obras').create<Obra>({
      ...data,
      user_id: user?.id,
      share_token: shareToken,
      total_budget: Number(data.total_budget) || 0,
    })
  },

  async update(id: string, data: Partial<Obra>): Promise<Obra> {
    return await pb.collection('obras').update<Obra>(id, {
      ...data,
      total_budget: data.total_budget !== undefined ? Number(data.total_budget) : undefined,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('obras').delete(id)
  },

  async deleteWithTransactions(id: string): Promise<boolean> {
    const linked = await pb.collection('transactions').getFullList<Transaction>({
      filter: `obra_id = "${id}"`,
      fields: 'id',
    })

    for (const tx of linked) {
      await pb.collection('transactions').delete(tx.id)
    }

    return await pb.collection('obras').delete(id)
  },

  async getFinancialSummary(obraId: string): Promise<{
    totalIncome: number
    totalExpenses: number
    netBalance: number
    budgetRemaining: number
    budgetPercent: number
    transactionsCount: number
    categoryTotals: Record<string, number>
  }> {
    const transactions = await pb.collection('transactions').getFullList<Transaction>({
      filter: `obra_id = "${obraId}"`,
    })

    let totalIncome = 0
    let totalExpenses = 0
    const categoryTotals: Record<string, number> = {}

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0
      if (tx.type === 'income') {
        totalIncome += amt
      } else {
        totalExpenses += amt
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt
      }
    })

    const obra = await this.getById(obraId)
    const budget = Number(obra.total_budget) || 0
    const budgetPercent = budget > 0 ? (totalExpenses / budget) * 100 : 0
    const budgetRemaining = budget - totalExpenses

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      budgetRemaining,
      budgetPercent,
      transactionsCount: transactions.length,
      categoryTotals,
    }
  },
}

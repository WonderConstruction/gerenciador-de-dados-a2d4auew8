import pb from '@/lib/pocketbase/client'
import { BotMessage, ReportConfig, TransactionCategory } from '@/types'

export const botService = {
  // Client-side rule engine fallback / fast categorization
  categorizeText(text: string): {
    category: TransactionCategory
    type: 'income' | 'expense'
    amount: number
    confidence: number
    matchedKeywords: string[]
  } {
    const lower = (text || '').toLowerCase()
    const matchedKeywords: string[] = []
    let category: TransactionCategory = 'other'
    let type: 'income' | 'expense' = 'expense'

    // 1. Structure / Frame
    if (/(frame|estrutura|madeira|viga|aço|aco|pilar|ferragem|treliça|trelica|laje)/.test(lower)) {
      category = 'frame'
      matchedKeywords.push('estrutura / frame')
    }
    // 2. Labor / Mão de Obra
    else if (
      /(mão de obra|mao de obra|labor|trabalhador|pedreiro|servente|equipe|diária|diaria|salário|salario|empreiteiro|ajudante|mestre)/.test(
        lower,
      )
    ) {
      category = 'labor'
      matchedKeywords.push('mão de obra / equipe')
    }
    // 3. Electrical / Elétrica
    else if (
      /(fio|tomada|elétrica|eletrica|luz|disjuntor|iluminação|iluminacao|led|cabo|eletroduto|quadro de luz|interruptor)/.test(
        lower,
      )
    ) {
      category = 'electrical'
      matchedKeywords.push('elétrica')
    }
    // 4. Plumbing / Hidráulica
    else if (
      /(cano|água|agua|pia|banheiro|tubo|esgoto|torneira|hidráulica|hidraulica|ralo|válvula|valvula|caixa d'água|registro)/.test(
        lower,
      )
    ) {
      category = 'plumbing'
      matchedKeywords.push('hidráulica / encanamento')
    }
    // 5. Materials / Materiais Básicos
    else if (
      /(cimento|tijolo|areia|brita|bloco|argamassa|concreto|materiais|material|cal|gesso cola|ferro 3\/8)/.test(
        lower,
      )
    ) {
      category = 'materials'
      matchedKeywords.push('materiais básicos')
    }
    // 6. Equipment / Equipamentos & Locação
    else if (
      /(máquina|maquina|equipamento|betoneira|andaime|locação|locacao|aluguel de ferramenta|ferramenta|compactador|furadeira)/.test(
        lower,
      )
    ) {
      category = 'equipment'
      matchedKeywords.push('equipamento / locação')
    }
    // 7. Finishing / Acabamentos & Pintura
    else if (
      /(pintura|tinta|acabamento|piso|porcelanato|rejunte|gesso|mármore|marmore|granito|verniz|massa corrida|rodapé|rodape)/.test(
        lower,
      )
    ) {
      category = 'finishing'
      matchedKeywords.push('acabamento / pintura')
    }
    // 8. Permits / Alvarás & Taxas
    else if (
      /(prefeitura|alvará|alvara|taxa|art|rrt|licença|licenca|cartório|cartorio|habite-se|crea|cau)/.test(
        lower,
      )
    ) {
      category = 'permits'
      matchedKeywords.push('alvarás / licenças')
    }

    // Type detection
    if (
      /(recebimento|aporte|entrada|medição recebida|medicao recebida|parcela cliente|pagamento do cliente|depósito do cliente|deposito cliente)/.test(
        lower,
      )
    ) {
      type = 'income'
      matchedKeywords.push('entrada / receita')
    }

    // Amount extraction
    let amount = 0
    const match = lower.match(/(?:r\$|\$)?\s*([0-9]+(?:[.,][0-9]{2,3})*(?:[.,][0-9]{2})?)/i)
    if (match && match[1]) {
      const cleanNum = match[1].replace(/\./g, '').replace(',', '.')
      const val = parseFloat(cleanNum)
      if (!isNaN(val) && val > 0) {
        amount = val
      }
    }

    return {
      category,
      type,
      amount,
      confidence: category !== 'other' ? 0.92 : 0.45,
      matchedKeywords,
    }
  },

  async parseWithBackend(description: string, amount?: number, obraId?: string) {
    try {
      const res = await pb.send('/api/custom/bot/parse-and-create', {
        method: 'POST',
        body: { description, amount, obra_id: obraId },
      })
      return res
    } catch {
      // Fallback to local rule engine
      return this.categorizeText(description)
    }
  },

  async getInboxMessages(): Promise<BotMessage[]> {
    return await pb.collection('bot_messages').getFullList<BotMessage>({
      sort: '-created',
    })
  },

  async deleteInboxMessage(id: string): Promise<boolean> {
    return await pb.collection('bot_messages').delete(id)
  },

  async updateInboxMessageStatus(
    id: string,
    status: 'processed' | 'pending_review' | 'error',
    transactionId?: string,
  ): Promise<BotMessage> {
    return await pb.collection('bot_messages').update<BotMessage>(id, {
      status,
      parsed_transaction_id: transactionId,
    })
  },

  async manageTelegramWebhook(params: {
    bot_token: string
    action: 'getWebhookInfo' | 'setWebhook' | 'deleteWebhook' | 'getMe'
    webhook_url?: string
  }) {
    return await pb.send('/api/custom/telegram/manage-webhook', {
      method: 'POST',
      body: params,
    })
  },
}

export const reportsService = {
  async getConfig(): Promise<ReportConfig | null> {
    const user = pb.authStore.model
    if (!user) return null
    try {
      const list = await pb.collection('report_configs').getList<ReportConfig>(1, 1, {
        filter: `user_id = "${user.id}"`,
      })
      return list.items[0] || null
    } catch {
      return null
    }
  },

  async saveConfig(data: Partial<ReportConfig>): Promise<ReportConfig> {
    const user = pb.authStore.model
    const current = await this.getConfig()

    if (current) {
      return await pb.collection('report_configs').update<ReportConfig>(current.id, data)
    } else {
      return await pb.collection('report_configs').create<ReportConfig>({
        ...data,
        user_id: user?.id,
        recipient_email: data.recipient_email || user?.email || '',
        weekly_enabled: data.weekly_enabled ?? true,
        weekly_day: data.weekly_day || 'monday',
        weekly_hour: data.weekly_hour ?? 8,
        monthly_enabled: data.monthly_enabled ?? true,
        monthly_day: data.monthly_day ?? 1,
        monthly_hour: data.monthly_hour ?? 8,
        include_all_obras: data.include_all_obras ?? true,
      })
    }
  },

  async triggerReport(type: 'weekly' | 'monthly', recipientEmail: string) {
    return await pb.send('/api/custom/reports/trigger', {
      method: 'POST',
      body: { type, recipient: recipientEmail },
    })
  },
}

export const sheetsService = {
  exportToCsv(obraName: string, transactions: any[]) {
    const headers = [
      'Data',
      'Tipo',
      'Categoria',
      'Descrição',
      'Valor (R$)',
      'Origem',
      'Sincronizado',
    ]
    const rows = transactions.map((t) => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.category,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      Number(t.amount || 0).toFixed(2),
      t.source || 'manual',
      t.sheets_synced ? 'SIM' : 'NÃO',
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `Planilha_${obraName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}

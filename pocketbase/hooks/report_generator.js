routerAdd('POST', '/api/custom/reports/trigger', (c) => {
  try {
    const data = c.requestInfo().body || {}
    const reportType = data.type || 'weekly'
    const recipient = (data.recipient || '').trim()

    if (!recipient) {
      return c.json(400, { ok: false, error: 'E-mail destinatário não fornecido' })
    }

    let obrasCount = 0
    let transactionsCount = 0
    let totalExpenses = 0
    let totalIncomes = 0

    try {
      const obras = $app.findRecordsByFilter('obras', '', '-created', 100, 0)
      obrasCount = obras.length

      const txs = $app.findRecordsByFilter('transactions', '', '-date', 500, 0)
      transactionsCount = txs.length

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i]
        const amt = tx.getFloat('amount') || 0
        const tType = tx.getString('type')
        if (tType === 'expense') {
          totalExpenses += amt
        } else if (tType === 'income') {
          totalIncomes += amt
        }
      }
    } catch (e) {
      console.warn('Error computing summary in reports/trigger:', e.message)
    }

    const summary = {
      type: reportType,
      recipient: recipient,
      obras_count: obrasCount,
      transactions_count: transactionsCount,
      total_expenses: totalExpenses,
      total_incomes: totalIncomes,
      balance: totalIncomes - totalExpenses,
      generated_at: new Date().toISOString(),
    }

    return c.json(200, {
      ok: true,
      message: 'Relatório ' + reportType + ' gerado com sucesso para ' + recipient,
      summary: summary,
    })
  } catch (err) {
    return c.json(500, { ok: false, error: err.message || 'Falha ao processar relatório' })
  }
})

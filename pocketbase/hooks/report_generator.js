// Hook for weekly and monthly report dispatch / preview
routerAdd('POST', '/api/custom/reports/trigger', (e) => {
  const req = e.requestInfo()
  const body = req.body || {}
  const reportType = body.type || 'weekly' // "weekly" or "monthly"
  const recipient = body.recipient || 'obrunolimaus@gmail.com'
  const userId = body.user_id || ''

  // Aggregate stats across obras
  let totalIncome = 0
  let totalExpenses = 0
  let obrasSummary = []
  let categoryBreakdown = {}

  try {
    const obras = $app.findRecordsByFilter('obras', '', '-created', 50, 0)
    const transactions = $app.findRecordsByFilter('transactions', '', '-date', 500, 0)

    for (let i = 0; i < obras.length; i++) {
      const o = obras[i]
      let oIncome = 0
      let oExpenses = 0

      for (let j = 0; j < transactions.length; j++) {
        const tx = transactions[j]
        if (tx.getString('obra_id') === o.id) {
          const amt = tx.getFloat('amount') || 0
          const type = tx.getString('type')
          const cat = tx.getString('category') || 'other'

          if (type === 'income') {
            oIncome += amt
            totalIncome += amt
          } else {
            oExpenses += amt
            totalExpenses += amt
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt
          }
        }
      }

      obrasSummary.push({
        id: o.id,
        name: o.getString('name'),
        client: o.getString('client_name'),
        budget: o.getFloat('total_budget'),
        income: oIncome,
        expenses: oExpenses,
        balance: oIncome - oExpenses,
        percentUsed:
          o.getFloat('total_budget') > 0
            ? ((oExpenses / o.getFloat('total_budget')) * 100).toFixed(1)
            : 0,
      })
    }

    const netBalance = totalIncome - totalExpenses
    const nowStr = new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })

    // Construct HTML email content
    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 8px;">
        <div style="background: #0f172a; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">🏗️ Gerenciador de Obras</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">Relatório ${reportType === 'weekly' ? 'Semanal Consolidado (Segunda-feira 08:00)' : 'Mensal de Desempenho e Custos'}</p>
        </div>
        
        <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 14px; color: #64748b; margin-top: 0;">Data de emissão: <strong>${nowStr}</strong> | Destinatário: <strong>${recipient}</strong></p>
          
          <div style="display: flex; gap: 12px; margin: 20px 0;">
            <div style="flex: 1; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 14px; border-radius: 6px; text-align: center;">
              <span style="font-size: 12px; color: #065f46; text-transform: uppercase; font-weight: bold;">Total Entradas</span>
              <div style="font-size: 20px; font-weight: bold; color: #047857; margin-top: 4px;">R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; padding: 14px; border-radius: 6px; text-align: center;">
              <span style="font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: bold;">Total Saídas</span>
              <div style="font-size: 20px; font-weight: bold; color: #b91c1c; margin-top: 4px;">R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 6px; text-align: center;">
              <span style="font-size: 12px; color: #1e40af; text-transform: uppercase; font-weight: bold;">Saldo Líquido</span>
              <div style="font-size: 20px; font-weight: bold; color: #1d4ed8; margin-top: 4px;">R$ ${netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <h3 style="font-size: 16px; color: #1e293b; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📊 Resumo por Obra</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                <th style="padding: 8px; border: 1px solid #e2e8f0;">Obra</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0;">Orçamento</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0;">Despesas</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0;">Saldo</th>
                <th style="padding: 8px; border: 1px solid #e2e8f0;">% Gasto</th>
              </tr>
            </thead>
            <tbody>
              ${obrasSummary
                .map(
                  (o) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${o.name}<br/><span style="font-weight: normal; font-size: 11px; color: #64748b;">${o.client || 'Sem cliente'}</span></td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">R$ ${o.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626;">R$ ${o.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; color: ${o.balance >= 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">R$ ${o.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${o.percentUsed}%</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px;">
            Gerado automaticamente pelo sistema <strong>Gerenciador de Obras</strong>.
          </div>
        </div>
      </div>
    `

    return e.json(200, {
      success: true,
      reportType: reportType,
      recipient: recipient,
      generatedAt: new Date().toISOString(),
      stats: {
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        netBalance: netBalance,
        obrasCount: obrasSummary.length,
        categoryBreakdown: categoryBreakdown,
      },
      obras: obrasSummary,
      htmlPreview: htmlEmail,
    })
  } catch (err) {
    return e.json(500, { error: err.message })
  }
})

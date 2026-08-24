console.log('bot_parser route registered')

// Hook for bot parsing & automatic categorization
routerAdd('POST', '/api/custom/bot/parse-and-create', (e) => {
  const req = e.requestInfo()
  const body = req.body || {}

  const text = (body.description || body.caption || '').toString().toLowerCase()
  const rawAmount = body.amount
  const obraId = body.obra_id || ''
  const platform = body.platform || 'simulated'
  const senderName = body.sender_name || 'Usuário Bot'

  let detectedCategory = 'other'

  if (
    text.includes('frame') ||
    text.includes('estrutura') ||
    text.includes('madeira') ||
    text.includes('viga') ||
    text.includes('aço') ||
    text.includes('pilar') ||
    text.includes('ferragem')
  ) {
    detectedCategory = 'frame'
  } else if (
    text.includes('mão de obra') ||
    text.includes('mao de obra') ||
    text.includes('labor') ||
    text.includes('trabalhador') ||
    text.includes('pedreiro') ||
    text.includes('servente') ||
    text.includes('equipe') ||
    text.includes('diária') ||
    text.includes('diaria') ||
    text.includes('salário') ||
    text.includes('salario')
  ) {
    detectedCategory = 'labor'
  } else if (
    text.includes('fio') ||
    text.includes('tomada') ||
    text.includes('elétrica') ||
    text.includes('eletrica') ||
    text.includes('luz') ||
    text.includes('disjuntor') ||
    text.includes('iluminação') ||
    text.includes('iluminacao') ||
    text.includes('led') ||
    text.includes('cabo') ||
    text.includes('eletroduto')
  ) {
    detectedCategory = 'electrical'
  } else if (
    text.includes('cano') ||
    text.includes('água') ||
    text.includes('agua') ||
    text.includes('pia') ||
    text.includes('banheiro') ||
    text.includes('tubo') ||
    text.includes('esgoto') ||
    text.includes('torneira') ||
    text.includes('hidráulica') ||
    text.includes('hidraulica') ||
    text.includes('ralo') ||
    text.includes('válvula')
  ) {
    detectedCategory = 'plumbing'
  } else if (
    text.includes('cimento') ||
    text.includes('tijolo') ||
    text.includes('areia') ||
    text.includes('brita') ||
    text.includes('bloco') ||
    text.includes('argamassa') ||
    text.includes('concreto') ||
    text.includes('materiais') ||
    text.includes('material')
  ) {
    detectedCategory = 'materials'
  } else if (
    text.includes('máquina') ||
    text.includes('maquina') ||
    text.includes('equipamento') ||
    text.includes('betoneira') ||
    text.includes('andaime') ||
    text.includes('locação') ||
    text.includes('locacao') ||
    text.includes('aluguel de ferramenta') ||
    text.includes('ferramenta')
  ) {
    detectedCategory = 'equipment'
  } else if (
    text.includes('pintura') ||
    text.includes('tinta') ||
    text.includes('acabamento') ||
    text.includes('piso') ||
    text.includes('porcelanato') ||
    text.includes('rejunte') ||
    text.includes('gesso') ||
    text.includes('mármore') ||
    text.includes('marmore') ||
    text.includes('granito') ||
    text.includes('verniz')
  ) {
    detectedCategory = 'finishing'
  } else if (
    text.includes('prefeitura') ||
    text.includes('alvará') ||
    text.includes('alvara') ||
    text.includes('taxa') ||
    text.includes('art') ||
    text.includes('rrt') ||
    text.includes('licença') ||
    text.includes('licenca') ||
    text.includes('cartório') ||
    text.includes('cartorio')
  ) {
    detectedCategory = 'permits'
  }

  // Detect type (income vs expense)
  let detectedType = 'expense'
  if (
    text.includes('recebimento') ||
    text.includes('aporte') ||
    text.includes('entrada') ||
    text.includes('medição recebida') ||
    text.includes('medicao recebida') ||
    text.includes('parcela cliente') ||
    text.includes('pagamento do cliente')
  ) {
    detectedType = 'income'
  }

  // Detect amount if not explicitly passed
  let parsedAmount = Number(rawAmount) || 0
  if (parsedAmount <= 0) {
    // Try to extract numbers from string e.g., "R$ 1.500,00" or "450.50" or "1250"
    const match = text.match(/(?:r\$|\$)?\s*([0-9]+(?:[\.,][0-9]{2,3})*(?:[\.,][0-9]{2})?)/i)
    if (match && match[1]) {
      let cleanNum = match[1].replace(/\./g, '').replace(',', '.')
      let val = parseFloat(cleanNum)
      if (!isNaN(val) && val > 0) {
        parsedAmount = val
      }
    }
  }

  return e.json(200, {
    success: true,
    suggestedCategory: detectedCategory,
    suggestedType: detectedType,
    suggestedAmount: parsedAmount,
    rawText: body.description || body.caption || '',
    confidence: detectedCategory !== 'other' ? 0.95 : 0.4,
    platform: platform,
    senderName: senderName,
  })
})

routerAdd('POST', '/api/custom/bot/parse-and-create', (c) => {
  try {
    const data = c.requestInfo().body || {}
    const description = (data.description || '').trim()
    let amount = Number(data.amount) || 0
    const obraId = data.obra_id || ''

    const lower = description.toLowerCase()
    let category = 'other'
    let type = 'expense'
    const matchedKeywords = []

    if (/(frame|estrutura|madeira|viga|aço|aco|pilar|ferragem|treliça|trelica|laje)/.test(lower)) {
      category = 'frame'
      matchedKeywords.push('estrutura / frame')
    } else if (
      /(mão de obra|mao de obra|labor|trabalhador|pedreiro|servente|equipe|diária|diaria|salário|salario|empreiteiro|ajudante|mestre)/.test(
        lower,
      )
    ) {
      category = 'labor'
      matchedKeywords.push('mão de obra / equipe')
    } else if (
      /(fio|tomada|elétrica|eletrica|luz|disjuntor|iluminação|iluminacao|led|cabo|eletroduto|quadro de luz|interruptor)/.test(
        lower,
      )
    ) {
      category = 'electrical'
      matchedKeywords.push('elétrica')
    } else if (
      /(cano|água|agua|pia|banheiro|tubo|esgoto|torneira|hidráulica|hidraulica|ralo|válvula|valvula|caixa d'água|registro)/.test(
        lower,
      )
    ) {
      category = 'plumbing'
      matchedKeywords.push('hidráulica / encanamento')
    } else if (
      /(cimento|tijolo|areia|brita|bloco|argamassa|concreto|materiais|material|cal|gesso cola|ferro 3\/8)/.test(
        lower,
      )
    ) {
      category = 'materials'
      matchedKeywords.push('materiais básicos')
    } else if (
      /(máquina|maquina|equipamento|betoneira|andaime|locação|locacao|aluguel de ferramenta|ferramenta|compactador|furadeira)/.test(
        lower,
      )
    ) {
      category = 'equipment'
      matchedKeywords.push('equipamento / locação')
    } else if (
      /(pintura|tinta|acabamento|piso|porcelanato|rejunte|gesso|mármore|marmore|granito|verniz|massa corrida|rodapé|rodape)/.test(
        lower,
      )
    ) {
      category = 'finishing'
      matchedKeywords.push('acabamento / pintura')
    } else if (
      /(prefeitura|alvará|alvara|taxa|art|rrt|licença|licenca|cartório|cartorio|habite-se|crea|cau)/.test(
        lower,
      )
    ) {
      category = 'permits'
      matchedKeywords.push('alvarás / licenças')
    }

    if (
      /(recebimento|aporte|entrada|medição recebida|medicao recebida|parcela cliente|pagamento do cliente|depósito do cliente|deposito cliente)/.test(
        lower,
      )
    ) {
      type = 'income'
      matchedKeywords.push('entrada / receita')
    }

    if (!amount) {
      const match = lower.match(/(?:r\$|\$)?\s*([0-9]+(?:[.,][0-9]{2,3})*(?:[.,][0-9]{2})?)/i)
      if (match && match[1]) {
        const cleanNum = match[1].replace(/\./g, '').replace(',', '.')
        const val = parseFloat(cleanNum)
        if (!isNaN(val) && val > 0) {
          amount = val
        }
      }
    }

    const authRecord = c.auth
    let createdTransactionId = null

    if (authRecord && obraId && amount > 0) {
      try {
        const txCol = $app.findCollectionByNameOrId('transactions')
        const newTx = new Record(txCol)
        newTx.set('obra_id', obraId)
        newTx.set('user_id', authRecord.id)
        newTx.set('type', type)
        newTx.set('amount', amount)
        newTx.set('category', category)
        newTx.set('description', description || 'Lançamento via Assistente')
        newTx.set('date', new Date().toISOString().slice(0, 10))
        newTx.set('source', 'telegram')
        newTx.set('raw_bot_text', description)
        $app.save(newTx)
        createdTransactionId = newTx.id
      } catch (err) {
        console.error('Failed to create transaction in parse-and-create:', err.message)
      }
    }

    return c.json(200, {
      category: category,
      type: type,
      amount: amount,
      confidence: category !== 'other' ? 0.92 : 0.45,
      matchedKeywords: matchedKeywords,
      createdTransactionId: createdTransactionId,
    })
  } catch (err) {
    return c.json(500, { error: err.message || 'Falha ao processar texto' })
  }
})

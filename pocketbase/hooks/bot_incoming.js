routerAdd('POST', '/api/custom/webhooks/bot-incoming', (c) => {
  try {
    const body = c.requestInfo().body || {}
    const message = body.message || body.edited_message || body

    const text = message.text || message.caption || ''
    const fromUser = message.from || {}
    const senderId = String(fromUser.id || '')
    const senderName =
      [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') ||
      fromUser.username ||
      'Telegram User'

    const lower = text.toLowerCase()
    let category = 'other'
    let type = 'expense'

    if (/(frame|estrutura|madeira|viga|aço|aco|pilar|ferragem|treliça|trelica|laje)/.test(lower)) {
      category = 'frame'
    } else if (
      /(mão de obra|mao de obra|labor|trabalhador|pedreiro|servente|equipe|diária|diaria|salário|salario|empreiteiro|ajudante|mestre)/.test(
        lower,
      )
    ) {
      category = 'labor'
    } else if (
      /(fio|tomada|elétrica|eletrica|luz|disjuntor|iluminação|iluminacao|led|cabo|eletroduto|quadro de luz|interruptor)/.test(
        lower,
      )
    ) {
      category = 'electrical'
    } else if (
      /(cano|água|agua|pia|banheiro|tubo|esgoto|torneira|hidráulica|hidraulica|ralo|válvula|valvula|caixa d'água|registro)/.test(
        lower,
      )
    ) {
      category = 'plumbing'
    } else if (
      /(cimento|tijolo|areia|brita|bloco|argamassa|concreto|materiais|material|cal|gesso cola|ferro 3\/8)/.test(
        lower,
      )
    ) {
      category = 'materials'
    } else if (
      /(máquina|maquina|equipamento|betoneira|andaime|locação|locacao|aluguel de ferramenta|ferramenta|compactador|furadeira)/.test(
        lower,
      )
    ) {
      category = 'equipment'
    } else if (
      /(pintura|tinta|acabamento|piso|porcelanato|rejunte|gesso|mármore|marmore|granito|verniz|massa corrida|rodapé|rodape)/.test(
        lower,
      )
    ) {
      category = 'finishing'
    } else if (
      /(prefeitura|alvará|alvara|taxa|art|rrt|licença|licenca|cartório|cartorio|habite-se|crea|cau)/.test(
        lower,
      )
    ) {
      category = 'permits'
    }

    if (
      /(recebimento|aporte|entrada|medição recebida|medicao recebida|parcela cliente|pagamento do cliente|depósito do cliente|deposito cliente)/.test(
        lower,
      )
    ) {
      type = 'income'
    }

    let amount = 0
    const match = lower.match(/(?:r\$|\$)?\s*([0-9]+(?:[.,][0-9]{2,3})*(?:[.,][0-9]{2})?)/i)
    if (match && match[1]) {
      const cleanNum = match[1].replace(/\./g, '').replace(',', '.')
      const val = parseFloat(cleanNum)
      if (!isNaN(val) && val > 0) {
        amount = val
      }
    }

    let assignedObraId = ''
    try {
      const obras = $app.findRecordsByFilter('obras', "status = 'em_andamento'", '-created', 1, 0)
      if (obras && obras.length > 0) {
        assignedObraId = obras[0].id
      }
    } catch (_) {}

    const botMsgCol = $app.findCollectionByNameOrId('bot_messages')
    const msgRecord = new Record(botMsgCol)
    msgRecord.set('platform', 'telegram')
    msgRecord.set('sender_id', senderId)
    msgRecord.set('sender_name', senderName)
    if (assignedObraId) {
      msgRecord.set('obra_id', assignedObraId)
    }
    msgRecord.set('caption', text)
    msgRecord.set('suggested_category', category)
    msgRecord.set('suggested_amount', amount)
    msgRecord.set('suggested_type', type)
    msgRecord.set('status', amount > 0 ? 'pending_review' : 'processed')
    msgRecord.set('payload_raw', body)
    $app.save(msgRecord)

    return c.json(200, {
      ok: true,
      message_id: msgRecord.id,
      category: category,
      amount: amount,
    })
  } catch (err) {
    console.error('Error processing bot-incoming webhook:', err.message)
    return c.json(200, { ok: false, error: err.message })
  }
})

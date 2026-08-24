// Webhook receiver for Telegram, WhatsApp and Simulator bots
routerAdd('POST', '/api/custom/webhooks/bot-incoming', (e) => {
  const req = e.requestInfo()
  const body = req.body || {}

  // Normalize incoming payload from Telegram or WhatsApp
  let platform = 'unknown'
  let senderName = 'Desconhecido'
  let senderId = ''
  let text = ''
  let fileUrl = ''
  let chatId = ''

  if (body.message && body.message.chat) {
    // Telegram format (message)
    platform = 'telegram'
    const msg = body.message
    senderName = msg.from
      ? ((msg.from.first_name || '') + ' ' + (msg.from.last_name || '')).trim() ||
        msg.from.username ||
        'Telegram User'
      : 'Telegram User'
    senderId = String(msg.chat.id || (msg.from && msg.from.id) || '')
    chatId = String(msg.chat.id || '')
    text = msg.caption || msg.text || ''
  } else if (body.edited_message && body.edited_message.chat) {
    // Telegram format (edited_message)
    platform = 'telegram'
    const msg = body.edited_message
    senderName = msg.from
      ? ((msg.from.first_name || '') + ' ' + (msg.from.last_name || '')).trim() ||
        msg.from.username ||
        'Telegram User'
      : 'Telegram User'
    senderId = String(msg.chat.id || (msg.from && msg.from.id) || '')
    chatId = String(msg.chat.id || '')
    text = msg.caption || msg.text || ''
  } else if (body.channel_post && body.channel_post.chat) {
    // Telegram format (channel_post)
    platform = 'telegram'
    const msg = body.channel_post
    senderName = msg.chat.title || 'Telegram Channel'
    senderId = String(msg.chat.id || '')
    chatId = String(msg.chat.id || '')
    text = msg.caption || msg.text || ''
  } else if (body.entry && body.entry[0] && body.entry[0].changes) {
    // WhatsApp Cloud API format
    platform = 'whatsapp'
    const change = body.entry[0].changes[0]
    const val = change && change.value ? change.value : {}
    const contact = val.contacts && val.contacts[0] ? val.contacts[0] : {}
    const msg = val.messages && val.messages[0] ? val.messages[0] : {}
    senderName = (contact.profile && contact.profile.name) || 'WhatsApp User'
    senderId = msg.from || ''
    text = msg.text
      ? msg.text.body
      : msg.image
        ? msg.image.caption
        : msg.document
          ? msg.document.caption
          : ''
  } else {
    // Custom test payload
    platform = body.platform || 'simulated'
    senderName = body.sender_name || 'Bot Webhook Client'
    senderId = body.sender_id || '123456'
    text = body.caption || body.description || body.text || ''
  }

  // Basic categorization logic inline
  const lower = (text || '').toLowerCase()
  let detectedCategory = 'other'
  if (
    lower.includes('frame') ||
    lower.includes('estrutura') ||
    lower.includes('madeira') ||
    lower.includes('viga') ||
    lower.includes('aço') ||
    lower.includes('aco') ||
    lower.includes('pilar') ||
    lower.includes('ferragem')
  ) {
    detectedCategory = 'frame'
  } else if (
    lower.includes('mão de obra') ||
    lower.includes('mao de obra') ||
    lower.includes('labor') ||
    lower.includes('pedreiro') ||
    lower.includes('servente') ||
    lower.includes('diária') ||
    lower.includes('diaria') ||
    lower.includes('ajudante')
  ) {
    detectedCategory = 'labor'
  } else if (
    lower.includes('fio') ||
    lower.includes('tomada') ||
    lower.includes('elétrica') ||
    lower.includes('eletrica') ||
    lower.includes('luz') ||
    lower.includes('led') ||
    lower.includes('cabo') ||
    lower.includes('disjuntor')
  ) {
    detectedCategory = 'electrical'
  } else if (
    lower.includes('cano') ||
    lower.includes('água') ||
    lower.includes('agua') ||
    lower.includes('pia') ||
    lower.includes('tubo') ||
    lower.includes('hidráulica') ||
    lower.includes('hidraulica') ||
    lower.includes('esgoto') ||
    lower.includes('torneira')
  ) {
    detectedCategory = 'plumbing'
  } else if (
    lower.includes('cimento') ||
    lower.includes('tijolo') ||
    lower.includes('areia') ||
    lower.includes('brita') ||
    lower.includes('bloco') ||
    lower.includes('material') ||
    lower.includes('argamassa')
  ) {
    detectedCategory = 'materials'
  } else if (
    lower.includes('máquina') ||
    lower.includes('maquina') ||
    lower.includes('equipamento') ||
    lower.includes('betoneira') ||
    lower.includes('andaime') ||
    lower.includes('locação') ||
    lower.includes('locacao') ||
    lower.includes('ferramenta')
  ) {
    detectedCategory = 'equipment'
  } else if (
    lower.includes('pintura') ||
    lower.includes('tinta') ||
    lower.includes('acabamento') ||
    lower.includes('piso') ||
    lower.includes('porcelanato') ||
    lower.includes('gesso') ||
    lower.includes('rejunte')
  ) {
    detectedCategory = 'finishing'
  } else if (
    lower.includes('prefeitura') ||
    lower.includes('alvará') ||
    lower.includes('alvara') ||
    lower.includes('taxa') ||
    lower.includes('art') ||
    lower.includes('rrt') ||
    lower.includes('licença')
  ) {
    detectedCategory = 'permits'
  }

  let detectedType =
    lower.includes('recebimento') ||
    lower.includes('aporte') ||
    lower.includes('entrada') ||
    lower.includes('medição')
      ? 'income'
      : 'expense'

  let detectedAmount = 0
  const match = lower.match(
    /(?:r\$|\$)?\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:\,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+)/i,
  )
  if (match && match[1]) {
    let cleanNum = match[1].replace(/\./g, '').replace(',', '.')
    let val = parseFloat(cleanNum)
    if (!isNaN(val)) detectedAmount = val
  }

  // Save into bot_messages collection
  try {
    const botMessagesCol = $app.findCollectionByNameOrId('bot_messages')
    const rec = new Record(botMessagesCol)
    rec.set('platform', platform)
    rec.set('sender_id', senderId)
    rec.set('sender_name', senderName)
    rec.set('caption', text)
    rec.set('suggested_category', detectedCategory)
    rec.set('suggested_amount', detectedAmount)
    rec.set('suggested_type', detectedType)
    rec.set('status', 'pending_review')
    rec.set('payload_raw', body)
    $app.save(rec)

    return e.json(200, {
      ok: true,
      received: true,
      message_id: rec.id,
      category: detectedCategory,
      amount: detectedAmount,
      type: detectedType,
      status: 'pending_review',
      instruction: 'Mensagem armazenada com sucesso no inbox do Gerenciador de Obras.',
    })
  } catch (err) {
    return e.json(200, {
      ok: true,
      received: true,
      fallback: true,
      error: err.message,
      category: detectedCategory,
      amount: detectedAmount,
    })
  }
})

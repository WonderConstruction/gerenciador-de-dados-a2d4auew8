cronAdd('telegram_cron_poller', '@every 10s', () => {
  try {
    const token = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'

    // 1. Fetch last_update_id from telegram_state
    let lastUpdateId = 0
    let stateRecord = null
    try {
      stateRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
      if (stateRecord) {
        lastUpdateId = Number(stateRecord.get('value')) || 0
      }
    } catch (_) {
      try {
        const msgs = $app.findRecordsByFilter(
          'telegram_messages',
          'update_id > 0',
          '-update_id',
          1,
          0,
        )
        if (msgs && msgs.length > 0) {
          lastUpdateId = Number(msgs[0].get('update_id')) || 0
        }
      } catch (_) {}
    }

    const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
    const getUpdatesUrl =
      'https://api.telegram.org/bot' +
      token +
      '/getUpdates?offset=' +
      nextOffset +
      '&timeout=5&limit=20'

    if (typeof $http === 'undefined' || !$http || !$http.send) {
      console.log('[Telegram Cron] $http is not available')
      return
    }

    const res = $http.send({
      url: getUpdatesUrl,
      method: 'GET',
      timeout: 10,
    })

    if (res.statusCode !== 200) {
      console.log('[Telegram Cron] Telegram API HTTP ' + res.statusCode + ':', res.raw)
      return
    }

    const data = res.json
    if (!data || !data.ok || !Array.isArray(data.result)) {
      console.log('[Telegram Cron] Invalid JSON structure from Telegram')
      return
    }

    const updates = data.result

    // Always update last_poll_at timestamp
    try {
      let lastPollRecord = null
      try {
        lastPollRecord = $app.findFirstRecordByData('telegram_state', 'key', 'last_poll_at')
      } catch (_) {}

      if (lastPollRecord) {
        lastPollRecord.set('text_value', new Date().toISOString())
        $app.save(lastPollRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_poll_at')
        rec.set('text_value', new Date().toISOString())
        $app.save(rec)
      }
    } catch (pollTimeErr) {
      console.log('[Telegram Cron] Could not update last_poll_at:', pollTimeErr)
    }

    if (updates.length === 0) {
      return
    }

    let maxProcessedUpdateId = lastUpdateId
    const telegramMessagesCol = $app.findCollectionByNameOrId('telegram_messages')

    for (let i = 0; i < updates.length; i++) {
      const u = updates[i]
      const uId = Number(u.update_id) || 0

      if (uId > maxProcessedUpdateId) {
        maxProcessedUpdateId = uId
      }

      const msg = u.message || u.edited_message || u.channel_post
      if (!msg) {
        continue
      }

      const chatId = msg.chat && msg.chat.id ? Number(msg.chat.id) : 0
      const messageText = msg.text || ''
      const caption = msg.caption || ''

      let fileId = ''
      let fileType = 'text'

      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1]
        fileId = largestPhoto.file_id || ''
        fileType = 'photo'
      } else if (msg.document) {
        fileId = msg.document.file_id || ''
        fileType = 'document'
      }

      // Check if message with this update_id is already inserted
      let alreadyExists = false
      try {
        const existing = $app.findFirstRecordByData('telegram_messages', 'update_id', uId)
        if (existing) {
          alreadyExists = true
        }
      } catch (_) {}

      if (!alreadyExists) {
        const newMsgRecord = new Record(telegramMessagesCol)
        newMsgRecord.set('update_id', uId)
        newMsgRecord.set('chat_id', chatId)
        newMsgRecord.set('message_text', messageText)
        newMsgRecord.set('caption', caption)
        newMsgRecord.set('file_id', fileId)
        newMsgRecord.set('file_type', fileType)
        newMsgRecord.set('raw_payload', u)
        newMsgRecord.set('processed', false)

        $app.save(newMsgRecord)
        console.log('[Telegram Cron] Ingested update_id ' + uId + ' from chat ' + chatId)
      }
    }

    // Update last_update_id in telegram_state
    if (maxProcessedUpdateId > lastUpdateId) {
      if (stateRecord) {
        stateRecord.set('value', maxProcessedUpdateId)
        $app.save(stateRecord)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const rec = new Record(stateCol)
        rec.set('key', 'last_update_id')
        rec.set('value', maxProcessedUpdateId)
        $app.save(rec)
      }
      console.log('[Telegram Cron] Advanced last_update_id to ' + maxProcessedUpdateId)
    }
  } catch (cronErr) {
    console.log('[Telegram Cron] Error during polling iteration:', cronErr)
  }
})

onRecordAfterCreateSuccess((e) => {
  try {
    const record = e.record
    const messageText = record.getString('message_text') || ''
    const caption = record.getString('caption') || ''
    let combinedText = (messageText || caption || '').trim()

    const rawPayload = record.get('raw_payload')
    if (rawPayload && typeof rawPayload === 'object') {
      const msg = rawPayload.message || rawPayload.channel_post || rawPayload.edited_message
      if (msg && typeof msg === 'object') {
        if (!combinedText) {
          combinedText = (msg.text || msg.caption || '').trim()
          if (msg.text && !record.getString('message_text')) {
            record.set('message_text', msg.text)
          }
          if (msg.caption && !record.getString('caption')) {
            record.set('caption', msg.caption)
          }
        }
      }
    }

    const lower = combinedText.toLowerCase()

    // 1. Amount Extraction (e.g. "R$ 350", "350,00", "R$ 1.250,50", "350", "valor 350")
    let amount = 0
    const amountMatch =
      lower.match(/(?:r\$|\$)?\s*([0-9]+(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i) ||
      lower.match(/(?:r\$|\$)\s*([0-9]+(?:[.,][0-9]{2})?)/i) ||
      lower.match(/([0-9]+(?:\.[0-9]{3})*,\s*[0-9]{2})/)

    if (amountMatch && amountMatch[1]) {
      let numStr = amountMatch[1].replace(/\s+/g, '')
      if (numStr.includes(',') && numStr.includes('.')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else if (numStr.includes(',')) {
        numStr = numStr.replace(',', '.')
      }
      const parsed = parseFloat(numStr)
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed
      }
    }

    if (amount === 0) {
      const simpleMatch = lower.match(/(?:r\$|\$|reais|valor\s*(?:de)?)\s*([0-9]+)/i)
      if (simpleMatch && simpleMatch[1]) {
        const parsed = parseFloat(simpleMatch[1])
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed
        }
      }
    }

    if (amount === 0) {
      const anyNumberMatch = lower.match(/\b([0-9]+(?:[.,][0-9]{2})?)\b/)
      if (anyNumberMatch && anyNumberMatch[1]) {
        const numStr = anyNumberMatch[1].replace(',', '.')
        const parsed = parseFloat(numStr)
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed
        }
      }
    }

    // 2. Category Identification by keywords
    // Keywords: frame, labor, electrical, plumbing, materials, equipment, finishing, permits
    let category = 'materials' // fallback

    if (
      /(pedreiro|servente|di[aá]ria|m[aã]o\s*de\s*obra|labor|trabalhador|ajudante|mestre|empreiteiro|sal[aá]rio|funcion[aá]rio)/.test(
        lower,
      )
    ) {
      category = 'labor'
    } else if (
      /(frame|estrutura|madeira|viga|caibro|tesoura|a[cç]o|pilar|ferragem|treli[cç]a|laje|ripa|pontalete|funda[cç][aã]o|forma)/.test(
        lower,
      )
    ) {
      category = 'frame'
    } else if (
      /(el[eé]tric|fio|tomada|disjuntor|quadro|condu[ií]te|luz|cabo|interruptor|ilumina[cç][aã]o|led|lumin[aá]ria|lampada|eletricista)/.test(
        lower,
      )
    ) {
      category = 'electrical'
    } else if (
      /(hidr[aá]ulic|plumbing|cano|tubula[cç][aã]o|torneira|encanador|[aá]gua|esgoto|pvc|pia|ralo|v[aá]lvula|registro|tigre|caixa\s*d['\s]?[aá]gua)/.test(
        lower,
      )
    ) {
      category = 'plumbing'
    } else if (
      /(acabamento|finishing|pintura|tinta|piso|azulejo|rejunte|gesso|massa\s*corrida|porcelanato|verniz|selador|rodap[eé]|m[aá]rmore|granito|pintor)/.test(
        lower,
      )
    ) {
      category = 'finishing'
    } else if (
      /(equipamento|equipment|betoneira|furadeira|serra|aluguel|m[aá]quina|andaime|loca[cç][aã]o|martelete|compactador|ferramenta)/.test(
        lower,
      )
    ) {
      category = 'equipment'
    } else if (
      /(alvar[aá]|permits|taxa|prefeitura|licen[cç]a|art|rrt|cart[oó]rio|habite-se|crea|cau|imposto)/.test(
        lower,
      )
    ) {
      category = 'permits'
    } else if (
      /(cimento|areia|tijolo|material|materials|compra|bloco|argamassa|cal|brita|ferro|pedra|pedrisco)/.test(
        lower,
      )
    ) {
      category = 'materials'
    }

    // 3. Type detection (expense default vs income)
    let type = 'expense'
    if (
      /(recebimento|pagamento\s*do\s*cliente|entrada|sinal|aporte|medi[cç][aã]o\s*recebida|parcela\s*cliente|dep[oó]sito\s*cliente)/.test(
        lower,
      )
    ) {
      type = 'income'
    }

    // 4. Obra Identification: match name or fallback to most recent obra
    let targetObra = null
    let targetUserId = ''

    try {
      const obras = $app.findRecordsByFilter('obras', '', '-created', 100, 0)
      if (obras && obras.length > 0) {
        for (let i = 0; i < obras.length; i++) {
          const o = obras[i]
          const oName = (o.getString('name') || '').toLowerCase().trim()
          if (oName && lower.includes(oName)) {
            targetObra = o
            break
          }
          const words = oName.split(/\s+/)
          for (let w = 0; w < words.length; w++) {
            const word = words[w].replace(/[^a-z0-9]/gi, '')
            if (word.length >= 3 && lower.includes(word)) {
              targetObra = o
              break
            }
          }
          if (targetObra) break
        }

        if (!targetObra) {
          targetObra = obras[0]
        }
      }
    } catch (_) {}

    if (targetObra) {
      targetUserId = targetObra.getString('user_id')
    }

    if (!targetUserId) {
      try {
        const admin = $app.findAuthRecordByEmail('_pb_users_auth_', 'obrunolimaus@gmail.com')
        targetUserId = admin.id
      } catch (_) {}
    }

    // 5. Create transaction record
    const txCol = $app.findCollectionByNameOrId('transactions')
    const tx = new Record(txCol)
    if (targetObra) {
      tx.set('obra_id', targetObra.id)
      tx.set('project', targetObra.getString('name'))
    } else {
      tx.set('project', 'Geral')
    }

    if (targetUserId) {
      tx.set('user_id', targetUserId)
    }

    tx.set('type', type)
    tx.set('amount', amount)
    tx.set('category', category)
    tx.set('description', combinedText || 'Mensagem recebida via Telegram Bot')
    tx.set('date', new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z')
    tx.set('source', 'telegram')
    tx.set('source_message', record.id)
    tx.set('status', 'pending')
    tx.set('raw_bot_text', combinedText)
    tx.set('sheets_synced', false)
    tx.set('notes', 'Auto-gerado via Telegram trigger')

    $app.save(tx)

    // Mark telegram message as processed
    record.set('processed', true)
    $app.save(record)

    console.log(
      '[Telegram Hook] Successfully processed message ' +
        record.id +
        ' -> Transaction ' +
        tx.id +
        ' (Amount: ' +
        amount +
        ', Cat: ' +
        category +
        ')',
    )
  } catch (err) {
    console.log('[Telegram Hook] Error processing record:', err)
  }

  e.next()
}, 'telegram_messages')

// Hook to automatically create and parse transactions whenever a new message is ingested into telegram_messages
// Note: PocketBase JSVM executes hook callbacks in separate VMs; keep handlers self-contained.

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

    // Check if transaction already exists for this source_message
    let existingTx = null
    try {
      existingTx = $app.findFirstRecordByData('transactions', 'source_message', record.id)
    } catch (_) {}

    if (!existingTx) {
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
    }

    // Mark telegram message as processed
    record.set('processed', true)
    $app.save(record)
  } catch (err) {
    console.log('[Telegram Hook] Error processing record:', err)
  }

  e.next()
}, 'telegram_messages')

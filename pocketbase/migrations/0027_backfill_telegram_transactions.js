migrate(
  (app) => {
    // 1. Check if amount is required in transactions collection; if so, keep amount > 0 or 0.01 if 0
    // Actually amount in PocketBase NumberField with required=true treats 0 as blank!
    // So if amount is 0, we can give a default of 0.00 or make amount not required if needed.
    const txCol = app.findCollectionByNameOrId('transactions')
    const amountField = txCol.fields.getByName('amount')
    if (amountField && amountField.required) {
      amountField.required = false
      app.save(txCol)
    }

    // Process any telegram_messages that don't have a transaction yet
    const msgs = app.findRecordsByFilter('telegram_messages', '', 'created', 100, 0)
    console.log('[Migration 0027] Processing', msgs.length, 'telegram messages...')

    for (let m = 0; m < msgs.length; m++) {
      const msgRec = msgs[m]

      // Check if already has a transaction
      let alreadyHasTx = false
      try {
        const existingTx = app.findRecordsByFilter(
          'transactions',
          'source_message = "' + msgRec.id + '"',
          '-created',
          1,
          0,
        )
        if (existingTx && existingTx.length > 0) {
          alreadyHasTx = true
        }
      } catch (_) {}

      if (alreadyHasTx) {
        msgRec.set('processed', true)
        app.save(msgRec)
        continue
      }

      const messageText = msgRec.getString('message_text') || ''
      const caption = msgRec.getString('caption') || ''
      let combinedText = (messageText || caption || '').trim()

      const rawPayload = msgRec.get('raw_payload')
      if (rawPayload && typeof rawPayload === 'object') {
        const msg = rawPayload.message || rawPayload.channel_post || rawPayload.edited_message
        if (msg && typeof msg === 'object') {
          if (!combinedText) {
            combinedText = (msg.text || msg.caption || '').trim()
          }
        }
      }

      const lower = combinedText.toLowerCase()

      // 1. Amount Extraction
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

      // 2. Category
      let category = 'materials'
      if (
        /(pedreiro|servente|di[aá]ria|m[aã]o\s*de\s*obra|labor|trabalhador|ajudante|mestre|empreiteiro|sal[aá]rio)/.test(
          lower,
        )
      ) {
        category = 'labor'
      } else if (
        /(frame|estrutura|madeira|viga|caibro|tesoura|a[cç]o|pilar|ferragem|treli[cç]a|laje|ripa|pontalete)/.test(
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
        /(hidr[aá]ulic|plumbing|cano|tubula[cç][aã]o|torneira|encanador|[aá]gua|esgoto|pvc|pia|ralo|v[aá]lvula|registro|tigre)/.test(
          lower,
        )
      ) {
        category = 'plumbing'
      } else if (
        /(acabamento|finishing|pintura|tinta|piso|azulejo|rejunte|gesso|massa\s*corrida|porcelanato|verniz|selador|rodap[eé]|m[aá]rmore|pintor)/.test(
          lower,
        )
      ) {
        category = 'finishing'
      } else if (
        /(equipamento|equipment|betoneira|furadeira|serra|aluguel|m[aá]quina|andaime|loca[cç][aã]o|martelete|compactador)/.test(
          lower,
        )
      ) {
        category = 'equipment'
      } else if (
        /(alvar[aá]|permits|taxa|prefeitura|licen[cç]a|art|rrt|cart[oó]rio|habite-se|crea|cau)/.test(
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

      // 3. Type
      let type = 'expense'
      if (
        /(recebimento|pagamento\s*do\s*cliente|entrada|sinal|aporte|medi[cç][aã]o\s*recebida|parcela\s*cliente|dep[oó]sito\s*cliente)/.test(
          lower,
        )
      ) {
        type = 'income'
      }

      // 4. Obra matching
      let targetObra = null
      let targetUserId = ''

      try {
        const obras = app.findRecordsByFilter('obras', '', '-created', 100, 0)
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
          const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'obrunolimaus@gmail.com')
          targetUserId = admin.id
        } catch (_) {}
      }

      // 5. Create transaction record
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
      tx.set('source_message', msgRec.id)
      tx.set('status', 'pending')
      tx.set('raw_bot_text', combinedText)
      tx.set('sheets_synced', false)
      tx.set('notes', 'Auto-gerado via Telegram trigger')

      app.save(tx)

      msgRec.set('processed', true)
      app.save(msgRec)
      console.log('[Migration 0027] Created transaction', tx.id, 'for telegram message', msgRec.id)
    }
  },
  (app) => {},
)

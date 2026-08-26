migrate(
  (app) => {
    // 1. Ensure telegram_messages collection has all needed fields & open create rule
    let telegramMessagesCol
    try {
      telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')
    } catch (_) {
      telegramMessagesCol = new Collection({
        name: 'telegram_messages',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'update_id', type: 'number' },
          { name: 'chat_id', type: 'number' },
          { name: 'message_text', type: 'text' },
          { name: 'caption', type: 'text' },
          { name: 'file_id', type: 'text' },
          { name: 'file_type', type: 'text' },
          { name: 'raw_payload', type: 'json' },
          { name: 'processed', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(telegramMessagesCol)
    }

    // 2. Ensure transactions collection has relation to source_message, status, project
    const transactionsCol = app.findCollectionByNameOrId('transactions')

    if (!transactionsCol.fields.getByName('source_message')) {
      transactionsCol.fields.add(
        new RelationField({
          name: 'source_message',
          collectionId: telegramMessagesCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    if (!transactionsCol.fields.getByName('status')) {
      transactionsCol.fields.add(
        new SelectField({
          name: 'status',
          values: ['pending', 'reviewed', 'exported'],
          maxSelect: 1,
        }),
      )
    }

    if (!transactionsCol.fields.getByName('project')) {
      transactionsCol.fields.add(
        new TextField({
          name: 'project',
        }),
      )
    }

    app.save(transactionsCol)

    // Helper parser function logic in migration for re-processing
    const processTelegramMessage = (msgRec) => {
      const messageText = msgRec.getString('message_text') || ''
      const caption = msgRec.getString('caption') || ''
      let combinedText = (messageText || caption || '').trim()

      const rawPayload = msgRec.get('raw_payload')
      if (rawPayload && typeof rawPayload === 'object') {
        const msg = rawPayload.message || rawPayload.channel_post || rawPayload.edited_message
        if (msg && typeof msg === 'object') {
          if (!combinedText) {
            combinedText = (msg.text || msg.caption || '').trim()
            if (msg.text && !msgRec.getString('message_text')) {
              msgRec.set('message_text', msg.text)
            }
            if (msg.caption && !msgRec.getString('caption')) {
              msgRec.set('caption', msg.caption)
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

      // If still 0, look for any standalone number in the text
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

      // 4. Obra Identification: match name (e.g. "720H", "Alphaville", "SkyTower", etc.) or use most recent obra
      let targetObra = null
      let targetUserId = ''

      try {
        const obras = app.findRecordsByFilter('obras', '', '-created', 100, 0)
        if (obras && obras.length > 0) {
          // Look for direct name match in text
          for (let i = 0; i < obras.length; i++) {
            const o = obras[i]
            const oName = (o.getString('name') || '').toLowerCase().trim()
            if (oName && lower.includes(oName)) {
              targetObra = o
              break
            }
            // Check simplified name words e.g. "720h" -> "720", "alphaville" -> "alphaville"
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

          // Fallback to most recently created / updated obra
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
      const tx = new Record(transactionsCol)
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
    }

    // 3. Register onRecordCreate hook on telegram_messages
    app.onRecordCreate('telegram_messages').bindFunc((e) => {
      try {
        processTelegramMessage(e.record)
      } catch (err) {
        console.log('[Telegram Hook] Error processing record:', err)
      }
      return e.next()
    })

    // 4. Process any existing unprocessed telegram_messages now
    try {
      const unprocessedMsgs = app.findRecordsByFilter(
        'telegram_messages',
        'processed = false || processed = null',
        'created',
        100,
        0,
      )
      console.log('[Telegram Migration 0026] Found', unprocessedMsgs.length, 'unprocessed messages')
      for (let i = 0; i < unprocessedMsgs.length; i++) {
        const msgRec = unprocessedMsgs[i]
        // Check if already has a transaction linked
        try {
          const existingTx = app.findRecordsByFilter(
            'transactions',
            'source_message = "' + msgRec.id + '"',
            '-created',
            1,
            0,
          )
          if (existingTx && existingTx.length > 0) {
            msgRec.set('processed', true)
            app.save(msgRec)
            continue
          }
        } catch (_) {}

        processTelegramMessage(msgRec)
      }
    } catch (unprocessedErr) {
      console.log('[Telegram Migration 0026] Note on backlog processing:', unprocessedErr)
    }
  },
  (app) => {
    // Revert logic if needed
  },
)

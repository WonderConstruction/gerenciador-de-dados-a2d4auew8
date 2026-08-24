migrate(
  (app) => {
    // 1. Load telegram_messages collection and ensure createRule allows anonymous/public inserts
    const telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')
    telegramMessagesCol.createRule = '' // Empty string allows public creation for Telegram webhook POSTs
    telegramMessagesCol.listRule = "@request.auth.id != ''"
    telegramMessagesCol.viewRule = "@request.auth.id != ''"
    telegramMessagesCol.updateRule = "@request.auth.id != ''"
    telegramMessagesCol.deleteRule = "@request.auth.id != ''"
    app.save(telegramMessagesCol)

    // 2. Ensure transactions collection has all needed fields and relations
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

    // 3. Register onRecordCreate hook on telegram_messages
    // Processes incoming messages: extracts text/caption/payload, amount, categorizes, extracts obra, and creates transaction
    app.onRecordCreate('telegram_messages').bindFunc((e) => {
      try {
        const record = e.record
        const messageText = record.getString('message_text') || ''
        const caption = record.getString('caption') || ''
        const rawPayload = record.get('raw_payload') || {}

        let combinedText = messageText || caption || ''
        let chatId = record.getInt('chat_id')
        let updateId = record.getInt('update_id')

        // If raw_payload contains standard Telegram Update object, extract deeper details if needed
        if (rawPayload && typeof rawPayload === 'object') {
          if (!updateId && rawPayload.update_id) {
            updateId = Number(rawPayload.update_id) || 0
            record.set('update_id', updateId)
          }

          const msg = rawPayload.message || rawPayload.channel_post || rawPayload.edited_message
          if (msg && typeof msg === 'object') {
            if (!combinedText) {
              combinedText = msg.text || msg.caption || ''
              if (msg.text && !record.getString('message_text')) {
                record.set('message_text', msg.text)
              }
              if (msg.caption && !record.getString('caption')) {
                record.set('caption', msg.caption)
              }
            }
            if (!chatId && msg.chat && msg.chat.id) {
              chatId = Number(msg.chat.id) || 0
              record.set('chat_id', chatId)
            }
            if (!record.getString('file_id')) {
              if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
                const largestPhoto = msg.photo[msg.photo.length - 1]
                record.set('file_id', largestPhoto.file_id || '')
                record.set('file_type', 'photo')
              } else if (msg.document) {
                record.set('file_id', msg.document.file_id || '')
                record.set('file_type', 'document')
              } else if (msg.text) {
                record.set('file_type', 'text')
              }
            }
          }
        }

        const lower = combinedText.toLowerCase()

        // 4. Categorization based on keywords:
        // labor: pedreiro, servente, mão de obra, diária, eletricista, pintor, etc.
        // frame: estrutura, fundação, viga, pilar, concreto, aço, etc.
        // electrical: elétrica, fio, disjuntor, tomada, eletricista, etc.
        // plumbing: hidráulica, encanador, água, esgoto, cano, torneira, etc.
        // materials: cimento, areia, tijolo, material, compra, etc.
        // equipment: equipamento, aluguel, máquina, betoneira, etc.
        // finishing: acabamento, pintura, piso, azulejo, gesso, pintor, etc.
        // permits: alvará, taxa, prefeitura, licença, etc.
        // Fallback: materials
        let category = 'materials'

        if (
          /(pedreiro|servente|di[aá]ria|m[aã]o\s*de\s*obra|trabalhador|ajudante|mestre|empreiteiro|sal[aá]rio)/.test(
            lower,
          )
        ) {
          category = 'labor'
        } else if (
          /(fio|tomada|disjuntor|quadro|condu[ií]te|el[eé]trico|el[eé]trica|luz|cabo|interruptor|ilumina[cç][aã]o|led|eletricista)/.test(
            lower,
          )
        ) {
          category = 'electrical'
        } else if (
          /(hidr[aá]ulica|encanador|[aá]gua|esgoto|cano|torneira|tubula[cç][aã]o|pvc|pia|ralo|v[aá]lvula|registro|tigre)/.test(
            lower,
          )
        ) {
          category = 'plumbing'
        } else if (
          /(acabamento|pintura|piso|azulejo|gesso|pintor|tinta|rejunte|massa\s*corrida|porcelanato|verniz|selador|rodap[eé]|m[aá]rmore)/.test(
            lower,
          )
        ) {
          category = 'finishing'
        } else if (
          /(equipamento|aluguel|m[aá]quina|betoneira|furadeira|serra|andaime|loca[cç][aã]o|martelete|compactador)/.test(
            lower,
          )
        ) {
          category = 'equipment'
        } else if (
          /(estrutura|funda[cç][aã]o|viga|pilar|concreto|a[cç]o|madeira|caibro|tesoura|ferragem|treli[cç]a|laje|ripa|pontalete)/.test(
            lower,
          )
        ) {
          category = 'frame'
        } else if (
          /(alvar[aá]|taxa|prefeitura|licen[cç]a|art|rrt|cart[oó]rio|habite-se|crea|cau)/.test(
            lower,
          )
        ) {
          category = 'permits'
        } else if (
          /(cimento|areia|tijolo|material|compra|bloco|argamassa|cal|brita|ferro|pedra|pedrisco)/.test(
            lower,
          )
        ) {
          category = 'materials'
        }

        // 5. Determine type: expense (default) or income (recebimento, pagamento do cliente, entrada, sinal)
        let type = 'expense'
        if (
          /(recebimento|pagamento\s*do\s*cliente|entrada|sinal|aporte|medi[cç][aã]o\s*recebida|parcela\s*cliente|dep[oó]sito\s*cliente)/.test(
            lower,
          )
        ) {
          type = 'income'
        }

        // 6. Extract monetary values (R$ X.XXX,XX or R$ XXX,XX or XXX.XX)
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

        // 7. Find default or matching obra and user
        let targetObra = null
        try {
          const obras = app.findRecordsByFilter('obras', '', '-created', 50, 0)
          if (obras && obras.length > 0) {
            for (let i = 0; i < obras.length; i++) {
              const oName = (obras[i].getString('name') || '').toLowerCase()
              if (oName && lower.includes(oName)) {
                targetObra = obras[i]
                break
              }
            }
            if (!targetObra) {
              targetObra = obras[0]
            }
          }
        } catch (_) {}

        // Fallback user ID
        let userId = targetObra ? targetObra.getString('user_id') : ''
        if (!userId) {
          try {
            const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'obrunolimaus@gmail.com')
            userId = admin.id
          } catch (_) {}
        }

        // 8. Create the transaction record with status pending
        const txCol = app.findCollectionByNameOrId('transactions')
        const tx = new Record(txCol)

        if (targetObra) {
          tx.set('obra_id', targetObra.id)
          tx.set('project', targetObra.getString('name'))
        } else {
          // If no obra was found at all, create or fallback
          try {
            const defaultObra = app.findFirstRecordByData(
              'obras',
              'name',
              'Residencial Alphaville - Casa 42',
            )
            tx.set('obra_id', defaultObra.id)
            tx.set('project', defaultObra.getString('name'))
          } catch (_) {}
        }

        if (userId) {
          tx.set('user_id', userId)
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
        tx.set('notes', 'Auto-gerado via Telegram onRecordCreate hook')

        app.save(tx)

        // Mark telegram_messages record as processed
        record.set('processed', true)
      } catch (hookErr) {
        // Continue event chain even if transaction generation encounters an edge case
      }

      return e.next()
    })
  },
  (app) => {
    // Revert logic if needed
  },
)

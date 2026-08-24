migrate(
  (app) => {
    // 1. Ensure or create telegram_messages collection
    let telegramMessagesCol
    try {
      telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')
    } catch (_) {
      telegramMessagesCol = new Collection({
        name: 'telegram_messages',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: '', // Public write so Telegram Webhook (or any client) can POST records
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
        indexes: [
          'CREATE INDEX idx_telegram_msgs_created ON telegram_messages (created DESC)',
          'CREATE INDEX idx_telegram_msgs_chat ON telegram_messages (chat_id)',
        ],
      })
      app.save(telegramMessagesCol)
    }

    // 2. Ensure transactions collection has all needed fields
    const transactionsCol = app.findCollectionByNameOrId('transactions')

    // Add source_message relation to telegram_messages if not present
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

    // Add status select field if not present (pending, reviewed, exported)
    if (!transactionsCol.fields.getByName('status')) {
      transactionsCol.fields.add(
        new SelectField({
          name: 'status',
          values: ['pending', 'reviewed', 'exported'],
          maxSelect: 1,
        }),
      )
    }

    // Add project text field if not present
    if (!transactionsCol.fields.getByName('project')) {
      transactionsCol.fields.add(
        new TextField({
          name: 'project',
        }),
      )
    }

    app.save(transactionsCol)

    // 3. Register onRecordCreate hook on telegram_messages
    // Whenever a new record is created in telegram_messages (e.g. from Telegram webhook POST),
    // extract message text / caption, parse amount, category, type, and create a transaction.
    app.onRecordCreate('telegram_messages').bindFunc((e) => {
      try {
        const record = e.record
        const messageText = record.getString('message_text') || ''
        const caption = record.getString('caption') || ''
        const rawPayload = record.get('raw_payload') || {}

        // Telegram payloads sent directly can have various shapes
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

        // 4. Categorization based on keywords
        let category = 'materials' // Default fallback

        if (
          /(pedreiro|servente|di[aá]ria|m[aã]o\s*de\s*obra|pintor|eletricista|trabalhador|ajudante|mestre|empreiteiro|sal[aá]rio)/.test(
            lower,
          )
        ) {
          category = 'labor'
        } else if (
          /(madeira|estrutura|viga|caibro|tesoura|a[cç]o|pilar|ferragem|treli[cç]a|laje|ripa|pontalete)/.test(
            lower,
          )
        ) {
          category = 'frame'
        } else if (
          /(fio|tomada|disjuntor|quadro|condu[ií]te|el[eé]trico|el[eé]trica|luz|cabo|interruptor|ilumina[cç][aã]o|led)/.test(
            lower,
          )
        ) {
          category = 'electrical'
        } else if (
          /(cano|tubula[cç][aã]o|torneira|encanador|[aá]gua|esgoto|pvc|hidr[aá]ulica|pia|ralo|v[aá]lvula|registro|tigre)/.test(
            lower,
          )
        ) {
          category = 'plumbing'
        } else if (
          /(cimento|areia|tijolo|bloco|argamassa|cal|brita|concreto|ferro|pedra|pedrisco)/.test(
            lower,
          )
        ) {
          category = 'materials'
        } else if (
          /(betoneira|furadeira|serra|aluguel|m[aá]quina|equipamento|andaime|loca[cç][aã]o|martelete|compactador)/.test(
            lower,
          )
        ) {
          category = 'equipment'
        } else if (
          /(tinta|piso|azulejo|rejunte|gesso|massa\s*corrida|acabamento|porcelanato|verniz|selador|rodap[eé]|m[aá]rmore)/.test(
            lower,
          )
        ) {
          category = 'finishing'
        } else if (
          /(alvar[aá]|taxa|prefeitura|licen[cç]a|art|rrt|cart[oó]rio|habite-se|crea|cau)/.test(
            lower,
          )
        ) {
          category = 'permits'
        }

        // 5. Determine type: expense (default) or income
        let type = 'expense'
        if (
          /(recebimento|pagamento\s*do\s*cliente|entrada|aporte|medi[cç][aã]o\s*recebida|parcela\s*cliente|dep[oó]sito\s*cliente)/.test(
            lower,
          )
        ) {
          type = 'income'
        }

        // 6. Extract amount (R$ XXX,XX or XXX.XX)
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

        // If no decimal format matched, try simple integer extraction near R$ or currency keywords
        if (amount === 0) {
          const simpleMatch = lower.match(/(?:r\$|\$|reais|valor\s*(?:de)?)\s*([0-9]+)/i)
          if (simpleMatch && simpleMatch[1]) {
            const parsed = parseFloat(simpleMatch[1])
            if (!isNaN(parsed) && parsed > 0) {
              amount = parsed
            }
          }
        }

        // Default amount if still 0
        if (amount <= 0) {
          amount = 0
        }

        // 7. Find default or matching obra and user
        let targetObra = null
        let targetUser = null

        try {
          // Check if any obra name is mentioned in text
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

        if (targetObra) {
          const uId = targetObra.getString('user_id')
          if (uId) {
            try {
              targetUser = app.findCollectionByNameOrId('_pb_users_auth_')
            } catch (_) {}
          }
        }

        // Fallback admin user if needed
        let userId = targetObra ? targetObra.getString('user_id') : ''
        if (!userId) {
          try {
            const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'obrunolimaus@gmail.com')
            userId = admin.id
          } catch (_) {}
        }

        // 8. Create the transaction record
        const txCol = app.findCollectionByNameOrId('transactions')
        const tx = new Record(txCol)

        if (targetObra) {
          tx.set('obra_id', targetObra.id)
          tx.set('project', targetObra.getString('name'))
        } else {
          tx.set('project', 'Geral')
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
        // Continue event chain even if transaction generation catches an issue
      }

      return e.next()
    })
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('telegram_messages')
      app.delete(col)
    } catch (_) {}
  },
)

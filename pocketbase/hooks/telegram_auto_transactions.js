// Hook to automatically create and parse transactions whenever a new message is ingested into telegram_messages
// When the message is a receipt PHOTO (even without the amount in the caption), the image is downloaded
// from Telegram and sent to the Skip AI gateway (vision) to extract valor/data/estabelecimento/categoria.
// Note: PocketBase JSVM executes hook callbacks in separate VMs; keep handlers self-contained.

onRecordAfterCreateSuccess((e) => {
  try {
    const record = e.record
    const messageText = record.getString('message_text') || ''
    const caption = record.getString('caption') || ''
    let combinedText = (messageText || caption || '').trim()

    // ---- Photo / file detection (from stored fields and raw Telegram payload) ----
    let fileId = record.getString('file_id') || ''
    let fileType = record.getString('file_type') || ''

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
        // Telegram sends photos as an array of sizes — the last one is the largest.
        if (msg.photo && msg.photo.length > 0) {
          fileType = 'photo'
          const biggest = msg.photo[msg.photo.length - 1]
          if (biggest && biggest.file_id && !fileId) {
            fileId = biggest.file_id
          }
        }
        // Image sent as document (common on WhatsApp-forwarded receipts)
        if (
          !fileId &&
          msg.document &&
          msg.document.mime_type &&
          msg.document.mime_type.indexOf('image/') === 0
        ) {
          fileType = 'photo'
          fileId = msg.document.file_id || ''
        }
      }
    }
    if (fileId && !record.getString('file_id')) {
      record.set('file_id', fileId)
    }
    if (fileType && !record.getString('file_type')) {
      record.set('file_type', fileType)
    }
    const isPhoto = !!fileId && (fileType === 'photo' || fileType === 'image')

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

    // 1b. Date extraction from text (dd/mm/yyyy or yyyy-mm-dd)
    let textDate = ''
    const dateMatch =
      lower.match(/\b([0-3][0-9])\/([0-1][0-9])\/([0-9]{4})\b/) ||
      lower.match(/\b([0-9]{4})-([0-1][0-9])-([0-3][0-9])\b/)
    if (dateMatch) {
      if (dateMatch[3].length === 4 && dateMatch[1].length === 2) {
        // dd/mm/yyyy
        textDate = dateMatch[3] + '-' + dateMatch[2] + '-' + dateMatch[1]
      } else {
        // yyyy-mm-dd
        textDate = dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3]
      }
    }

    // 2. Category Identification by keywords
    let category = 'materials' // fallback
    let categoryWasFallback = true

    if (
      /(pedreiro|servente|di[aá]ria|m[aã]o\s*de\s*obra|labor|trabalhador|ajudante|mestre|empreiteiro|sal[aá]rio|funcion[aá]rio)/.test(
        lower,
      )
    ) {
      category = 'labor'
      categoryWasFallback = false
    } else if (
      /(frame|estrutura|madeira|viga|caibro|tesoura|a[cç]o|pilar|ferragem|treli[cç]a|laje|ripa|pontalete|funda[cç][aã]o|forma)/.test(
        lower,
      )
    ) {
      category = 'frame'
      categoryWasFallback = false
    } else if (
      /(el[eé]tric|fio|tomada|disjuntor|quadro|condu[ií]te|luz|cabo|interruptor|ilumina[cç][aã]o|led|lumin[aá]ria|lampada|eletricista)/.test(
        lower,
      )
    ) {
      category = 'electrical'
      categoryWasFallback = false
    } else if (
      /(hidr[aá]ulic|plumbing|cano|tubula[cç][aã]o|torneira|encanador|[aá]gua|esgoto|pvc|pia|ralo|v[aá]lvula|registro|tigre|caixa\s*d['\s]?[aá]gua)/.test(
        lower,
      )
    ) {
      category = 'plumbing'
      categoryWasFallback = false
    } else if (
      /(acabamento|finishing|pintura|tinta|piso|azulejo|rejunte|gesso|massa\s*corrida|porcelanato|verniz|selador|rodap[eé]|m[aá]rmore|granito|pintor)/.test(
        lower,
      )
    ) {
      category = 'finishing'
      categoryWasFallback = false
    } else if (
      /(equipamento|equipment|betoneira|furadeira|serra|aluguel|m[aá]quina|andaime|loca[cç][aã]o|martelete|compactador|ferramenta)/.test(
        lower,
      )
    ) {
      category = 'equipment'
      categoryWasFallback = false
    } else if (
      /(alvar[aá]|permits|taxa|prefeitura|licen[cç]a|art|rrt|cart[oó]rio|habite-se|crea|cau|imposto)/.test(
        lower,
      )
    ) {
      category = 'permits'
      categoryWasFallback = false
    } else if (
      /(cimento|areia|tijolo|material|materials|compra|bloco|argamassa|cal|brita|ferro|pedra|pedrisco)/.test(
        lower,
      )
    ) {
      category = 'materials'
      categoryWasFallback = false
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

    // 3b. AI vision extraction for receipt photos: fills amount/date/merchant/category
    // that the caption did not provide. Runs only when data is missing; anything
    // already parsed from the caption takes precedence over the AI result.
    let aiAmount = 0
    let aiDate = ''
    let aiMerchant = ''
    let aiCategory = ''
    let aiRaw = ''
    let ocrSource = ''

    if (isPhoto && (amount === 0 || categoryWasFallback || !textDate)) {
      try {
        const botToken = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'

        // Step 1: ask Telegram where the file lives
        const gfRes = $http.send({
          url: 'https://api.telegram.org/bot' + botToken + '/getFile',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileId }),
          timeout: 20,
        })
        let filePath = ''
        try {
          const gfJson = gfRes.json
          if (gfJson && gfJson.result && gfJson.result.file_path) {
            filePath = gfJson.result.file_path
          }
        } catch (_) {}
        console.log(
          '[Telegram Hook] getFile for ' +
            record.id +
            ' status=' +
            gfRes.statusCode +
            ' path=' +
            filePath,
        )

        // Step 2: download the image bytes and encode as base64
        let imageBase64 = ''
        if (filePath) {
          const fileUrl = 'https://api.telegram.org/file/bot' + botToken + '/' + filePath
          try {
            const imgFile = $filesystem.fileFromURL(fileUrl)
            imageBase64 = Buffer.from(imgFile.reader.bytes).toString('base64')
          } catch (dlErr) {
            console.log('[Telegram Hook] fileFromURL failed, trying $http.send: ' + dlErr)
            try {
              const imgRes = $http.send({ url: fileUrl, method: 'GET', timeout: 60 })
              const rawBody = imgRes.body !== undefined ? imgRes.body : imgRes.raw
              imageBase64 = Buffer.from(rawBody).toString('base64')
            } catch (dlErr2) {
              console.log('[Telegram Hook] image download failed: ' + dlErr2)
            }
          }
        }

        if (imageBase64.length > 0) {
          const promptText =
            'Analise a imagem de um recibo/comprovante fiscal brasileiro (nota fiscal, cupom ou comprovante de pagamento) de uma obra de construção civil. Extraia os dados e responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato exato: {"valor": 0, "data": "YYYY-MM-DD", "nome_estabelecimento": "", "categoria": "materials"}. Regras: "valor" é o valor TOTAL pago em reais como número com ponto decimal (ex: 1250.50); "data" é a data de emissão do recibo no formato YYYY-MM-DD (use null se não encontrar); "nome_estabelecimento" é a razão social ou nome fantasia da loja/empresa (use null se não encontrar); "categoria" deve ser exatamente UMA destas opções: frame, labor, electrical, plumbing, materials, equipment, finishing, permits, other (escolha a mais adequada ao tipo de compra/serviço do recibo).' +
            (combinedText
              ? ' Contexto: legenda enviada pelo usuário junto da foto: "' + combinedText + '".'
              : '')

          const chatBody = {
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é um extrator de dados de recibos brasileiros. Responda exclusivamente com JSON válido, sem markdown e sem explicações.',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  {
                    type: 'image_url',
                    image_url: { url: 'data:image/jpeg;base64,' + imageBase64 },
                  },
                ],
              },
            ],
            temperature: 0,
            max_tokens: 400,
          }

          // Build candidate gateway URLs robustly: the env var may be a bare
          // host, an OpenAI-style base (…/v1) or already point at the endpoint.
          let gwUrl = ($os.getenv('SKIP_AI_GATEWAY_URL') || '').trim()
          const gwKey = ($os.getenv('SKIP_AI_GATEWAY_API_KEY') || '').trim()
          const candidates = []
          if (gwUrl) {
            gwUrl = gwUrl.replace(/\/+$/, '')
            if (/\/chat\/completions$/.test(gwUrl)) {
              candidates.push(gwUrl)
            } else if (/\/v[0-9]+$/.test(gwUrl)) {
              candidates.push(gwUrl + '/chat/completions')
            } else {
              candidates.push(gwUrl + '/v1/chat/completions')
              candidates.push(gwUrl + '/chat/completions')
              candidates.push(gwUrl + '/api/chat/completions')
            }
          }

          const aiHeaders = { 'Content-Type': 'application/json' }
          if (gwKey) {
            aiHeaders['Authorization'] = 'Bearer ' + gwKey
            aiHeaders['apikey'] = gwKey
          }

          for (let c = 0; c < candidates.length; c++) {
            const res = $http.send({
              url: candidates[c],
              method: 'POST',
              headers: aiHeaders,
              body: JSON.stringify(chatBody),
              timeout: 90,
            })
            console.log(
              '[Telegram Hook] AI vision attempt ' +
                (c + 1) +
                '/' +
                candidates.length +
                ' url=' +
                candidates[c] +
                ' status=' +
                res.statusCode,
            )
            if (res.statusCode !== 200) {
              console.log(
                '[Telegram Hook] AI gateway non-200 body: ' + String(res.raw).substring(0, 500),
              )
              continue
            }
            let choiceContent = ''
            try {
              const rj = res.json
              if (rj && rj.choices && rj.choices.length > 0 && rj.choices[0].message) {
                choiceContent = rj.choices[0].message.content || ''
              }
            } catch (pErr) {
              console.log('[Telegram Hook] AI response parse error: ' + pErr)
            }
            console.log(
              '[Telegram Hook] AI vision reply: ' + String(choiceContent).substring(0, 800),
            )

            // Defensive JSON extraction (models add preambles/markdown fences)
            const text = String(choiceContent)
            const start = text.indexOf('{')
            const end = text.lastIndexOf('}')
            if (start === -1 || end <= start) {
              console.log('[Telegram Hook] AI reply has no JSON object')
              continue
            }
            let parsed = null
            try {
              parsed = JSON.parse(text.substring(start, end + 1))
            } catch (jErr) {
              console.log('[Telegram Hook] AI JSON.parse failed: ' + jErr)
              continue
            }
            if (parsed && typeof parsed === 'object') {
              const rawAmount =
                parsed.valor !== undefined
                  ? parsed.valor
                  : parsed.amount !== undefined
                    ? parsed.amount
                    : parsed.total
              const parsedAmount = parseFloat(rawAmount)
              if (!isNaN(parsedAmount) && parsedAmount > 0) {
                aiAmount = parsedAmount
              }
              const rawDate = parsed.data || parsed.date || ''
              if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                aiDate = rawDate.substring(0, 10)
              }
              const rawMerchant =
                parsed.nome_estabelecimento || parsed.estabelecimento || parsed.merchant || ''
              if (typeof rawMerchant === 'string' && rawMerchant.trim() && rawMerchant !== 'null') {
                aiMerchant = rawMerchant.trim()
              }
              const validCats = [
                'frame',
                'labor',
                'electrical',
                'plumbing',
                'materials',
                'equipment',
                'finishing',
                'permits',
                'other',
              ]
              const rawCat = parsed.categoria || parsed.category || ''
              if (typeof rawCat === 'string' && validCats.indexOf(rawCat.trim()) !== -1) {
                aiCategory = rawCat.trim()
              }
              aiRaw = text.substring(start, end + 1).substring(0, 2000)
              ocrSource = 'ai_vision'
              break
            }
          }
        } else {
          console.log('[Telegram Hook] Could not download receipt image for record ' + record.id)
        }
      } catch (aiErr) {
        // Never break the hook because of the AI extraction
        console.log('[Telegram Hook] AI vision extraction failed: ' + aiErr)
      }
    }

    // Merge AI data into the parsed values — never overwrite what the caption gave us
    if (aiAmount > 0 && amount === 0) {
      amount = aiAmount
    }
    if (aiCategory && categoryWasFallback) {
      category = aiCategory
      categoryWasFallback = false
    }
    if (aiMerchant) {
      const merchantLower = aiMerchant.toLowerCase()
      if (!combinedText) {
        combinedText = 'Recibo - ' + aiMerchant
      } else if (!lower.includes(merchantLower)) {
        combinedText = combinedText + ' — ' + aiMerchant
      }
    }
    if (ocrSource) {
      console.log(
        '[Telegram Hook] OCR result for ' +
          record.id +
          ' amount=' +
          amount +
          ' date=' +
          (textDate || aiDate) +
          ' merchant=' +
          aiMerchant +
          ' category=' +
          category,
      )
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

      const txDate = textDate || aiDate
      if (txDate) {
        tx.set('date', txDate + ' 12:00:00.000Z')
      } else {
        tx.set('date', new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z')
      }

      tx.set('source', 'telegram')
      tx.set('source_message', record.id)
      tx.set('status', 'pending')
      tx.set('raw_bot_text', combinedText)
      tx.set('sheets_synced', false)

      if (ocrSource) {
        tx.set('notes', 'Auto-gerado via Telegram trigger (OCR por IA)')
        tx.set('ocr_extracted_data', {
          source: ocrSource,
          valor: aiAmount,
          data: aiDate,
          nome_estabelecimento: aiMerchant,
          categoria: aiCategory,
          raw_reply: aiRaw,
        })
      } else {
        tx.set('notes', 'Auto-gerado via Telegram trigger')
      }

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
          ', OCR: ' +
          (ocrSource || 'none') +
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

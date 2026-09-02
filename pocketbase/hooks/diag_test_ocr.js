// Diagnostic hook: tests the AI vision pipeline end-to-end against the LAST
// receipt photo stored in telegram_messages — reproducing the exact calls the
// main hook (telegram_auto_transactions) makes, step by step.
// Route: POST /backend/v1/diag/test-ocr  (public, remove after debugging)

routerAdd('POST', '/backend/v1/diag/test-ocr', (e) => {
  const out = {}
  try {
    // 0. native $ai gateway present?
    out.ai_global = typeof $ai !== 'undefined' ? 'present' : 'MISSING'

    // 1. env vars
    const gwUrl = ($os.getenv('SKIP_AI_GATEWAY_URL') || '').trim()
    const gwKey = ($os.getenv('SKIP_AI_GATEWAY_API_KEY') || '').trim()
    out.env = { url_len: gwUrl.length, key_len: gwKey.length, url: gwUrl }
    if (!gwUrl || !gwKey) {
      return e.json(200, Object.assign(out, { error: 'missing gateway env vars' }))
    }

    // 2. pick the most recent receipt photo (same criteria as the main hook)
    let rec = null
    try {
      rec = $app.findFirstRecordByData('telegram_messages', 'file_type', 'photo')
    } catch (_) {}
    if (!rec) {
      return e.json(200, Object.assign(out, { error: 'no telegram photo message found' }))
    }
    out.msg_id = rec.id
    out.caption = rec.getString('caption') || ''

    let fileId = rec.getString('file_id') || ''
    const rawPayload = rec.get('raw_payload')
    if (rawPayload && typeof rawPayload === 'object') {
      const msg = rawPayload.message || rawPayload.channel_post || rawPayload.edited_message
      if (msg && typeof msg === 'object' && msg.photo && msg.photo.length > 0) {
        fileId = msg.photo[msg.photo.length - 1].file_id || fileId
      }
    }
    out.file_id = fileId.substring(0, 30) + '...'

    // 3. Telegram getFile
    const botToken = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
    const gfRes = $http.send({
      url: 'https://api.telegram.org/bot' + botToken + '/getFile',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
      timeout: 20,
    })
    out.getfile_status = gfRes.statusCode
    let filePath = ''
    try {
      const gfJson = gfRes.json
      if (gfJson && gfJson.result && gfJson.result.file_path) filePath = gfJson.result.file_path
    } catch (_) {}
    out.file_path = filePath
    if (!filePath) return e.json(200, Object.assign(out, { error: 'getFile failed' }))

    // 4. download image + base64
    const fileUrl = 'https://api.telegram.org/file/bot' + botToken + '/' + filePath
    let imageBase64 = ''
    let dlVia = ''
    try {
      const imgFile = $filesystem.fileFromURL(fileUrl)
      imageBase64 = Buffer.from(imgFile.reader.bytes).toString('base64')
      dlVia = 'fileFromURL'
    } catch (dlErr) {
      out.fileFromURL_error = String(dlErr)
      try {
        const imgRes = $http.send({ url: fileUrl, method: 'GET', timeout: 60 })
        const rawBody = imgRes.body !== undefined ? imgRes.body : imgRes.raw
        imageBase64 = Buffer.from(rawBody).toString('base64')
        dlVia = 'http_send'
        out.http_status = imgRes.statusCode
      } catch (dlErr2) {
        out.http_error = String(dlErr2)
      }
    }
    out.dl_via = dlVia
    out.b64_len = imageBase64.length
    if (imageBase64.length > 0) {
      out.b64_head = imageBase64.substring(0, 24)
    }
    if (!imageBase64) return e.json(200, Object.assign(out, { error: 'image download failed' }))

    // 5. AI vision call (OpenAI-compatible chat/completions with image_url)
    const promptText =
      'Analise a imagem de um recibo/comprovante fiscal brasileiro de uma obra de construção civil. Extraia os dados e responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato exato: {"valor": 0, "data": "YYYY-MM-DD", "nome_estabelecimento": "", "categoria": "materials"}. "valor" é o valor TOTAL pago em reais como número com ponto decimal; "data" é a data de emissão em YYYY-MM-DD (null se não encontrar); "nome_estabelecimento" é o nome da loja/empresa (null se não encontrar); "categoria" deve ser exatamente UMA destas opções: frame, labor, electrical, plumbing, materials, equipment, finishing, permits, other.'

    const messages = [
      {
        role: 'system',
        content:
          'Você é um extrator de dados de recibos brasileiros. Responda exclusivamente com JSON válido, sem markdown e sem explicações.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } },
        ],
      },
    ]

    const gw = gwUrl.replace(/\/+$/, '')
    const endpoints = [gw + '/v1/chat/completions', gw + '/chat/completions', gw + '/responses']
    out.endpoints = endpoints

    const variants = [
      {
        name: 'temperature+max_tokens',
        body: { model: 'fast', messages: messages, temperature: 0, max_tokens: 400 },
      },
      {
        name: 'max_completion_tokens',
        body: { model: 'fast', messages: messages, max_completion_tokens: 400 },
      },
      { name: 'bare', body: { model: 'fast', messages: messages } },
    ]

    const attempts = []
    let found = false
    outer: for (let u = 0; u < endpoints.length && !found; u++) {
      for (let v = 0; v < variants.length; v++) {
        let res
        try {
          res = $http.send({
            url: endpoints[u],
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + gwKey,
              apikey: gwKey,
            },
            body: JSON.stringify(variants[v].body),
            timeout: 90,
          })
        } catch (sendErr) {
          attempts.push({ url: endpoints[u], variant: variants[v].name, error: String(sendErr) })
          continue
        }
        const attempt = {
          url: endpoints[u],
          variant: variants[v].name,
          status: res.statusCode,
          body_head: String(res.raw).substring(0, 400),
        }
        attempts.push(attempt)
        if (res.statusCode !== 200) continue

        let content = ''
        try {
          const rj = res.json
          if (rj && rj.choices && rj.choices.length > 0 && rj.choices[0].message) {
            content = rj.choices[0].message.content || ''
          }
          if (!content && rj && rj.output_text) content = rj.output_text
        } catch (_) {}
        attempt.reply = String(content).substring(0, 800)
        if (content) {
          const start = String(content).indexOf('{')
          const end = String(content).lastIndexOf('}')
          if (start !== -1 && end > start) {
            try {
              out.extracted = JSON.parse(String(content).substring(start, end + 1))
              out.working_url = endpoints[u]
              out.working_variant = variants[v].name
              found = true
            } catch (jErr) {
              attempt.parse_error = String(jErr)
            }
          }
        }
      }
    }

    // 6. native $ai.chat probe (text-only) — what the main hook would use as Path A
    if (typeof $ai !== 'undefined') {
      try {
        const r = $ai.chat({
          model: 'fast',
          messages: [{ role: 'user', content: 'Responda apenas: {"valor": 123.45}' }],
        })
        out.ai_chat_status = 'ok'
        try {
          out.ai_chat_reply = String(r.choices[0].message.content).substring(0, 200)
        } catch (_) {
          out.ai_chat_reply = String(r).substring(0, 200)
        }
      } catch (aiErr) {
        out.ai_chat_error = String(aiErr)
      }
    }

    out.attempts = attempts
    return e.json(200, out)
  } catch (err) {
    return e.json(500, { error: String(err), partial: out })
  }
})

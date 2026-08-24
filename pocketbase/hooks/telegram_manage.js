// Telegram Webhook Management Helper — verify bot token, check webhook status, set webhook, delete webhook
routerAdd('POST', '/api/custom/telegram/manage-webhook', (e) => {
  const req = e.requestInfo()
  const body = req.body || {}
  const botToken = (body.bot_token || '').trim()
  const action = body.action || 'getWebhookInfo' // 'getWebhookInfo' | 'setWebhook' | 'deleteWebhook' | 'getMe'
  const customWebhookUrl = body.webhook_url || ''

  if (!botToken) {
    return e.json(400, {
      ok: false,
      error: 'Token do bot é obrigatório (ex: 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ)',
    })
  }

  // Sanitize token
  if (!botToken.match(/^[0-9]+:[a-zA-Z0-9_\-]+$/)) {
    return e.json(400, {
      ok: false,
      error: 'Formato de token do Telegram inválido. Deve ser no padrão: 123456789:AAXXXXXXXXX...',
    })
  }

  const telegramApiUrl = 'https://api.telegram.org/bot' + botToken

  try {
    if (action === 'getMe') {
      const res = $http.send({
        url: telegramApiUrl + '/getMe',
        method: 'GET',
        timeout: 10,
      })
      return e.json(200, res.json)
    }

    if (action === 'getWebhookInfo') {
      const res = $http.send({
        url: telegramApiUrl + '/getWebhookInfo',
        method: 'GET',
        timeout: 10,
      })
      return e.json(200, res.json)
    }

    if (action === 'setWebhook') {
      if (!customWebhookUrl) {
        return e.json(400, {
          ok: false,
          error: 'URL do Webhook é obrigatória para registrar no Telegram.',
        })
      }

      const res = $http.send({
        url: telegramApiUrl + '/setWebhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: customWebhookUrl,
          allowed_updates: ['message', 'edited_message'],
          drop_pending_updates: false,
        }),
        timeout: 15,
      })
      return e.json(200, res.json)
    }

    if (action === 'deleteWebhook') {
      const res = $http.send({
        url: telegramApiUrl + '/deleteWebhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_pending_updates: false,
        }),
        timeout: 10,
      })
      return e.json(200, res.json)
    }

    return e.json(400, { ok: false, error: 'Ação não reconhecida' })
  } catch (err) {
    return e.json(500, {
      ok: false,
      error: 'Falha na comunicação com a API do Telegram: ' + err.message,
    })
  }
})

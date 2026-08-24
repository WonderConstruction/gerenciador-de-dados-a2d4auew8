routerAdd('POST', '/api/custom/telegram/manage-webhook', (c) => {
  try {
    const data = c.requestInfo().body || {}
    const botToken = (data.bot_token || '').trim()
    const action = data.action || 'getMe'
    const webhookUrl = (data.webhook_url || '').trim()

    if (!botToken) {
      return c.json(400, { ok: false, error: 'Token do bot Telegram não fornecido' })
    }

    const telegramBase = 'https://api.telegram.org/bot' + botToken

    if (action === 'getMe') {
      const res = $http.send({
        url: telegramBase + '/getMe',
        method: 'GET',
        timeout: 15,
      })
      return c.json(res.statusCode, res.json)
    }

    if (action === 'getWebhookInfo') {
      const res = $http.send({
        url: telegramBase + '/getWebhookInfo',
        method: 'GET',
        timeout: 15,
      })
      return c.json(res.statusCode, res.json)
    }

    if (action === 'setWebhook') {
      if (!webhookUrl) {
        return c.json(400, { ok: false, error: 'URL do webhook não fornecida' })
      }
      const res = $http.send({
        url: telegramBase + '/setWebhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'edited_message'],
          drop_pending_updates: false,
        }),
        timeout: 15,
      })
      return c.json(res.statusCode, res.json)
    }

    if (action === 'deleteWebhook') {
      const res = $http.send({
        url: telegramBase + '/deleteWebhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_pending_updates: false,
        }),
        timeout: 15,
      })
      return c.json(res.statusCode, res.json)
    }

    return c.json(400, { ok: false, error: 'Ação de webhook não reconhecida: ' + action })
  } catch (err) {
    return c.json(500, {
      ok: false,
      error: err.message || 'Erro interno ao comunicar com Telegram',
    })
  }
})

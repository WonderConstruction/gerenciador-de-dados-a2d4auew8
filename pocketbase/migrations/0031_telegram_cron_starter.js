migrate(
  (app) => {
    const debugCol = app.findCollectionByNameOrId('debug_inspect')

    let log = 'MIG_0031_CRON_START: '

    try {
      if (typeof app.cron === 'function') {
        const cronRunner = app.cron()
        log += 'hasStarted=' + cronRunner.hasStarted() + ' | '

        cronRunner.mustAdd('telegram_cron_poller_31', '* * * * *', () => {
          console.log('[TELEGRAM CRON POLLER 31 TICK]')
          try {
            const token = '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
            // fetch last_update_id
            let lastUpdateId = 0
            try {
              const stateRecord = app.findFirstRecordByData(
                'telegram_state',
                'key',
                'last_update_id',
              )
              if (stateRecord) {
                lastUpdateId = Number(stateRecord.get('value')) || 0
              }
            } catch (_) {}

            const nextOffset = lastUpdateId > 0 ? lastUpdateId + 1 : 0
            const url =
              'https://api.telegram.org/bot' +
              token +
              '/getUpdates?offset=' +
              nextOffset +
              '&timeout=5&limit=20'

            if (typeof $http !== 'undefined' && $http && $http.send) {
              const res = $http.send({ url: url, method: 'GET', timeout: 10 })
              if (
                res.statusCode === 200 &&
                res.json &&
                res.json.ok &&
                Array.isArray(res.json.result)
              ) {
                const updates = res.json.result
                const msgCol = app.findCollectionByNameOrId('telegram_messages')
                let maxId = lastUpdateId
                for (let i = 0; i < updates.length; i++) {
                  const u = updates[i]
                  const uId = Number(u.update_id) || 0
                  if (uId > maxId) maxId = uId
                  const msg = u.message || u.edited_message || u.channel_post
                  if (!msg) continue

                  let alreadyExists = false
                  try {
                    if (app.findFirstRecordByData('telegram_messages', 'update_id', uId))
                      alreadyExists = true
                  } catch (_) {}

                  if (!alreadyExists) {
                    const r = new Record(msgCol)
                    r.set('update_id', uId)
                    r.set('chat_id', msg.chat && msg.chat.id ? Number(msg.chat.id) : 0)
                    r.set('message_text', msg.text || '')
                    r.set('caption', msg.caption || '')
                    r.set('raw_payload', u)
                    r.set('processed', false)
                    app.save(r)
                  }
                }

                if (maxId > lastUpdateId) {
                  try {
                    const st = app.findFirstRecordByData('telegram_state', 'key', 'last_update_id')
                    st.set('value', maxId)
                    app.save(st)
                  } catch (_) {}
                }
              }
            }
          } catch (cronExecErr) {
            console.log('[CRON EXEC ERR]', cronExecErr)
          }
        })

        // Call cronRunner.start() explicitly
        if (!cronRunner.hasStarted() && typeof cronRunner.start === 'function') {
          cronRunner.start()
          log += 'called cronRunner.start() | '
        }
        log += 'hasStartedAfter=' + cronRunner.hasStarted() + ' | '
        log += 'totalJobs=' + (typeof cronRunner.total === 'function' ? cronRunner.total() : '?')
      }
    } catch (e) {
      log += 'CRON ERR: ' + e
    }

    const rec = new Record(debugCol)
    rec.set('output', log)
    app.save(rec)
  },
  (app) => {},
)

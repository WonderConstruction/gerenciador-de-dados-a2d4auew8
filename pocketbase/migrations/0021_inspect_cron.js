migrate(
  (app) => {
    const outputCol = app.findCollectionByNameOrId('debug_inspect')

    let log = ''
    try {
      const cronObj = app.cron()
      log += 'app.cron() type: ' + typeof cronObj
      if (cronObj) {
        log += ' | isArray: ' + Array.isArray(cronObj)
        try {
          log += ' | keys: ' + Object.keys(cronObj).join(', ')
        } catch (e) {
          log += ' | keys err: ' + e
        }
        try {
          log += ' | props: ' + Object.getOwnPropertyNames(cronObj).join(', ')
        } catch (e) {}
      }
    } catch (e) {
      log += 'app.cron() call err: ' + e
    }

    const rec = new Record(outputCol)
    rec.set('output', log)
    app.save(rec)
  },
  (app) => {},
)

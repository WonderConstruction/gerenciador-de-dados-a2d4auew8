migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    // Let's inspect onServe, onBootstrap, onBatchRequest, onRecordRequest
    let serveHooks = ['onServe', 'onBootstrap', 'onBatchRequest', 'onRecordRequest']
    for (let sh of serveHooks) {
      if (typeof app[sh] === 'function') {
        try {
          let hookObj = app[sh]()
          let keys = []
          for (let k in hookObj) keys.push(k)
          let r = new Record(col)
          r.set('output', sh + '() keys: ' + keys.join(', '))
          app.save(r)
        } catch (e) {
          let r = new Record(col)
          r.set('output', sh + '() error: ' + e.message)
          app.save(r)
        }
      }
    }
  },
  (app) => {},
)

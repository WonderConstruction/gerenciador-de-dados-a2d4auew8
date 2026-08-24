migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    // Let's also check onRecordCreate / onRecordRequest / onCollection / onBatchRequest / router
    // What event hooks exist for HTTP requests or routing?
    app.onServe().bindFunc((e) => {
      // When onServe fires:
      // e has router? e.router / e.server / etc.
      try {
        let eKeys = []
        for (let k in e) {
          eKeys.push(k + ' (' + typeof e[k] + ')')
        }
        let r = new Record(col)
        r.set('output', 'onServe EVENT: ' + eKeys.join(', '))
        app.save(r)

        if (e.router) {
          e.router.get('/custom/ping', (c) => {
            return c.json(200, {
              ok: true,
              time: new Date().toISOString(),
              source: 'onServe.router',
            })
          })
          e.router.get('/api/custom/ping', (c) => {
            return c.json(200, {
              ok: true,
              time: new Date().toISOString(),
              source: 'onServe.router.api',
            })
          })
        }
      } catch (err) {
        let r = new Record(col)
        r.set('output', 'onServe EVENT ERR: ' + err.message)
        app.save(r)
      }
      return e.next()
    })

    // What about onRecordListRequest or other request hooks?
    // Can we inspect what methods app has for router?
    let routerProps = []
    if (app.router) {
      for (let k in app.router) {
        routerProps.push(k + ' (' + typeof app.router[k] + ')')
      }
    }

    let rec = new Record(col)
    rec.set('output', 'app.router: ' + (app.router ? routerProps.join(', ') : 'null'))
    app.save(rec)
  },
  (app) => {},
)

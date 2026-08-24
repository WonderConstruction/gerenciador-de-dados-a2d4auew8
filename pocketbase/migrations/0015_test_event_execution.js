migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    // Let's test onRecordCreate to see if hooks registered in migrations actually run when records are created!
    app.onRecordCreate().bindFunc((e) => {
      try {
        e.record.set('output', (e.record.get('output') || '') + ' [HOOK_ON_RECORD_CREATE_RAN]')
      } catch (err) {}
      return e.next()
    })

    // Let's bind onServe as well
    app.onServe().bindFunc((e) => {
      try {
        if (e.router) {
          e.router.get('/custom/ping', (c) => {
            return c.json(200, {
              ok: true,
              time: new Date().toISOString(),
              source: 'migration_onServe_router',
            })
          })
          e.router.get('/api/custom/ping', (c) => {
            return c.json(200, {
              ok: true,
              time: new Date().toISOString(),
              source: 'migration_onServe_router_api',
            })
          })
        }
      } catch (err) {}
      return e.next()
    })

    // Let's test if onRecordCreate hook fires right now
    let testRec = new Record(col)
    testRec.set('output', 'TEST_RECORD_BEFORE_HOOK')
    app.save(testRec)
  },
  (app) => {},
)

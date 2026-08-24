migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    let rec = new Record(col)
    rec.set('output', 'TESTING bind vs bindFunc')

    // Let's test registering a hook with bind or bindFunc
    try {
      app.onServe().bindFunc((e) => {
        console.log('onServe bindFunc triggered!')
        return e.next()
      })
      rec.set('output', rec.get('output') + ' -> bindFunc worked!')
    } catch (e) {
      rec.set('output', rec.get('output') + ' -> bindFunc failed: ' + e.message)
    }

    try {
      app.onServe().bind({
        id: 'test_ping_hook',
        func: (e) => {
          console.log('onServe bind triggered!')
          return e.next()
        },
      })
      rec.set('output', rec.get('output') + ' -> bind worked!')
    } catch (e) {
      rec.set('output', rec.get('output') + ' -> bind failed: ' + e.message)
    }

    app.save(rec)
  },
  (app) => {},
)

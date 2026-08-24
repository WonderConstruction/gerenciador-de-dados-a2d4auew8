migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    // Let's test registering onRecordListRequest or onRecordViewRequest or onBatchRequest
    try {
      app.onRecordListRequest().bindFunc((e) => {
        // Whenever a list request happens
        return e.next()
      })
      let r = new Record(col)
      r.set('output', 'onRecordListRequest bindFunc success!')
      app.save(r)
    } catch (e) {
      let r = new Record(col)
      r.set('output', 'onRecordListRequest err: ' + e.message)
      app.save(r)
    }
  },
  (app) => {},
)

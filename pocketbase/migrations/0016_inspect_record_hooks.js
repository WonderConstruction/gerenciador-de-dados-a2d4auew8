migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    // Let's test onRecordCreate with bot_messages collection
    // When a message is created in bot_messages, can we intercept it, parse it, run AI or regex, and create the transaction automatically?
    // Let's also check if onRecordRequest exists: onRecordRequest, onRecordViewRequest, onRecordCreateRequest, etc.

    let recHooks = [
      'onRecordCreate',
      'onRecordCreateRequest',
      'onRecordCreateExecute',
      'onRecordAfterCreateSuccess',
      'onRecordUpdateRequest',
      'onRecordAfterUpdateSuccess',
    ]
    let available = []
    for (let h of recHooks) {
      if (typeof app[h] === 'function') {
        available.push(h)
      }
    }

    let r = new Record(col)
    r.set('output', 'AVAILABLE RECORD HOOKS ON APP: ' + available.join(', '))
    app.save(r)
  },
  (app) => {},
)

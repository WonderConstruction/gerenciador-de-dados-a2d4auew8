migrate(
  (app) => {
    let info = []
    info.push('typeof app: ' + typeof app)

    let props = []
    for (let k in app) {
      props.push(k + ' (' + typeof app[k] + ')')
    }
    info.push('app props: ' + props.join(', '))

    if (app.onServe) {
      let serveProps = []
      try {
        let s = app.onServe()
        for (let k in s) {
          serveProps.push(k + ' (' + typeof s[k] + ')')
        }
        info.push('app.onServe() props: ' + serveProps.join(', '))
      } catch (e) {
        info.push('app.onServe() error: ' + e.message)
      }
    }

    try {
      info.push('global routerAdd: ' + typeof routerAdd)
    } catch (e) {
      info.push('global routerAdd err: ' + e.message)
    }

    let col
    try {
      col = app.findCollectionByNameOrId('debug_inspect')
    } catch (e) {
      col = new Collection({
        name: 'debug_inspect',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'output', type: 'text', maxSize: 100000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(col)
    }

    let fullText = info.join('\n---\n').slice(0, 4000)
    let rec = new Record(col)
    rec.set('output', fullText)
    app.save(rec)
  },
  (app) => {},
)

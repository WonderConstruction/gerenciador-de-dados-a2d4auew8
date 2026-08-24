migrate(
  (app) => {
    // Let's create an inspect collection or log record to inspect the exact app object properties
    let info = []
    info.push('typeof app: ' + typeof app)

    // Inspect all properties of app
    let props = []
    for (let k in app) {
      props.push(k + ' (' + typeof app[k] + ')')
    }
    info.push('app props: ' + props.join(', '))

    // Check OnBeforeServe / onBeforeServe / OnServe / onServe / routerAdd / etc.
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

    // Also check if routerAdd exists in global scope
    try {
      info.push('global routerAdd: ' + typeof routerAdd)
    } catch (e) {
      info.push('global routerAdd err: ' + e.message)
    }

    // Let's save this info to a dummy collection or write to a test table
    // We can create a collection _temp_inspect to read it via db_query
    try {
      let col
      try {
        col = app.findCollectionByNameOrId('_temp_inspect')
      } catch (e) {
        col = new Collection({
          name: '_temp_inspect',
          type: 'base',
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: '',
          fields: [
            { name: 'output', type: 'text' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
        })
        app.save(col)
      }

      let rec = new Record(col)
      rec.set('output', info.join('\n'))
      app.save(rec)
    } catch (e) {
      // if collection fails, fallback to raw sql table
      app
        .db()
        .newQuery('CREATE TABLE IF NOT EXISTS _debug_log (id TEXT PRIMARY KEY, output TEXT)')
        .execute()
      app
        .db()
        .newQuery("INSERT INTO _debug_log (id, output) VALUES ('test1', {:out})")
        .bind({ out: info.join('\n') })
        .execute()
    }
  },
  (app) => {},
)

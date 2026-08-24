migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    let allProps = Object.keys(app).sort()
    let serveRelated = allProps.filter(
      (p) =>
        p.toLowerCase().includes('serve') ||
        p.toLowerCase().includes('route') ||
        p.toLowerCase().includes('hook') ||
        p.toLowerCase().includes('http') ||
        p.toLowerCase().includes('bind') ||
        p.startsWith('on') ||
        p.startsWith('On'),
    )

    let rec = new Record(col)
    rec.set('output', 'ALL_ON_SERVE_HOOKS: ' + serveRelated.join('\n'))
    app.save(rec)

    // Let's also check what onServe returns or how onServe is typed
    let rec2 = new Record(col)
    if (app.onServe) {
      try {
        let serveHook = app.onServe()
        let serveHookProps = []
        for (let k in serveHook) {
          serveHookProps.push(k + ': ' + typeof serveHook[k])
        }
        rec2.set('output', 'onServe() object keys: ' + serveHookProps.join(', '))
      } catch (e) {
        rec2.set('output', 'onServe() call err: ' + e.message)
      }
    } else {
      rec2.set('output', 'app.onServe is missing')
    }
    app.save(rec2)
  },
  (app) => {},
)

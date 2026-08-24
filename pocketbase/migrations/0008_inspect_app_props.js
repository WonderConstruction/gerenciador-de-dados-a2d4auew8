migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    let allProps = []
    for (let k in app) {
      allProps.push(k)
    }

    let chunkSize = 3000
    let fullStr = allProps.sort().join(', ')
    for (let i = 0; i < fullStr.length; i += chunkSize) {
      let rec = new Record(col)
      rec.set('output', 'CHUNK ' + i + ': ' + fullStr.slice(i, i + chunkSize))
      app.save(rec)
    }

    // Let's also check hooks/serve/router properties specifically
    let serveRelated = allProps.filter(
      (p) =>
        p.toLowerCase().includes('serve') ||
        p.toLowerCase().includes('route') ||
        p.toLowerCase().includes('hook') ||
        p.toLowerCase().includes('http') ||
        p.toLowerCase().includes('bind') ||
        p.toLowerCase().includes('on'),
    )
    let rec2 = new Record(col)
    rec2.set('output', 'SERVE/ROUTE/ON RELATED: ' + serveRelated.join(', '))
    app.save(rec2)
  },
  (app) => {},
)

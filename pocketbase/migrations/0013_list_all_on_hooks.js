migrate(
  (app) => {
    let col = app.findCollectionByNameOrId('debug_inspect')

    let allOn = Object.keys(app)
      .filter((k) => k.startsWith('on') || k.startsWith('On'))
      .sort()

    for (let i = 0; i < allOn.length; i += 20) {
      let r = new Record(col)
      r.set('output', 'ON_HOOKS ' + i + ': ' + allOn.slice(i, i + 20).join(', '))
      app.save(r)
    }
  },
  (app) => {},
)

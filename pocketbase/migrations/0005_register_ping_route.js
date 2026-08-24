migrate(
  (app) => {
    console.log('--- START 0005_inspect_app ---')
    console.log('app keys:', Object.keys(app))
    console.log('app.onServe:', app.onServe)
    console.log('typeof app.onServe:', typeof app.onServe)
    if (typeof app.onServe === 'function') {
      const res = app.onServe()
      console.log('app.onServe() result:', res, typeof res, res ? Object.keys(res) : null)
    }
    console.log('--- FINISH 0005_inspect_app ---')
  },
  (app) => {},
)

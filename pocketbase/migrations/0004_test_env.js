migrate(
  (app) => {
    console.log('--- RUNNING MIGRATION 0004_test_env ---')
    console.log('Type of app:', typeof app)
    console.log('App methods:', Object.keys(app))
    console.log('typeof routerAdd in migration:', typeof routerAdd)
  },
  (app) => {},
)

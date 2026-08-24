console.log('ping route registering...')

routerAdd('GET', '/api/custom/ping', (e) => {
  return e.json(200, { ok: true, time: new Date().toISOString() })
})

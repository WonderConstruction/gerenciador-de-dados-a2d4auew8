console.log('ping hook loaded')

onBootstrap((e) => {
  console.log('ping onBootstrap called')
  e.next()
})

routerAdd('GET', '/api/custom/ping', (c) => {
  console.log('ping endpoint called')
  return c.json(200, { ok: true, time: new Date().toISOString() })
})

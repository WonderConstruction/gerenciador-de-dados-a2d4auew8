console.log('ping hook loaded')

routerAdd('GET', '/api/custom/ping', (c) => {
  return c.json(200, { ok: true, time: new Date().toISOString() })
})

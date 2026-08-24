console.log('PING HOOK LOADED')

routerAdd('GET', '/custom/ping', (c) => {
  return c.json(200, { ok: true, time: new Date().toISOString() })
})

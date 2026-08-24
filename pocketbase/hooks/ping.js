console.log('--- TEST HOOK BOOTSTRAP STARTING ---')

routerAdd('GET', '/custom/ping', (c) => {
  console.log('HIT /custom/ping')
  return c.json(200, { ok: true, source: 'root-ping' })
})

routerAdd('GET', '/api/custom/ping', (c) => {
  console.log('HIT /api/custom/ping')
  return c.json(200, { ok: true, source: 'api-ping' })
})

console.log('--- TEST HOOK BOOTSTRAP FINISHED ---')

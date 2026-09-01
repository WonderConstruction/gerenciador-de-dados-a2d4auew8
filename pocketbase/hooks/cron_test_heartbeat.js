// Teste de observabilidade de cronAdd no Skip Cloud (PocketBase JSVM)
// Roda a cada 1 minuto e grava um carimbo no banco na coleção 'cron_test_logs' e em 'telegram_state'

cronAdd('cron_test_heartbeat', '@every 1m', () => {
  const nowIso = new Date().toISOString()
  console.log('[CRON_TEST_HEARTBEAT] Executando heartbeat do cronAdd às ' + nowIso)

  try {
    // 1. Grava novo registro na coleção dedicada 'cron_test_logs'
    try {
      const col = $app.findCollectionByNameOrId('cron_test_logs')
      const count = $app.countRecords('cron_test_logs')
      const rec = new Record(col)
      rec.set('timestamp', nowIso)
      rec.set('job_name', 'cron_test_heartbeat')
      rec.set('tick_count', count + 1)
      rec.set('message', 'Execucao automatica cronAdd @every 1m registrada com sucesso')
      $app.save(rec)
      console.log(
        '[CRON_TEST_HEARTBEAT] Registro criado na tabela cron_test_logs (tick: ' +
          (count + 1) +
          ')',
      )
    } catch (dbErr) {
      console.log('[CRON_TEST_HEARTBEAT] Erro ao gravar em cron_test_logs:', dbErr)
    }

    // 2. Grava ou atualiza a chave 'cron_test_last_tick' na coleção 'telegram_state'
    try {
      let stateRec = null
      try {
        stateRec = $app.findFirstRecordByData('telegram_state', 'key', 'cron_test_last_tick')
      } catch (_) {}

      if (stateRec) {
        const currentTicks = Number(stateRec.get('value')) || 0
        stateRec.set('value', currentTicks + 1)
        stateRec.set('text_value', nowIso)
        $app.save(stateRec)
      } else {
        const stateCol = $app.findCollectionByNameOrId('telegram_state')
        const newRec = new Record(stateCol)
        newRec.set('key', 'cron_test_last_tick')
        newRec.set('value', 1)
        newRec.set('text_value', nowIso)
        $app.save(newRec)
      }
      console.log('[CRON_TEST_HEARTBEAT] Atualizado telegram_state cron_test_last_tick: ' + nowIso)
    } catch (stateErr) {
      console.log('[CRON_TEST_HEARTBEAT] Erro ao gravar em telegram_state:', stateErr)
    }
  } catch (err) {
    console.log('[CRON_TEST_HEARTBEAT] Erro fatal no handler:', err)
  }
})

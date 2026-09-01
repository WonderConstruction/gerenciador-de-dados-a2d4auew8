migrate(
  (app) => {
    const debugCol = app.findCollectionByNameOrId('debug_inspect')

    let log = 'MIG_0030_START: '

    // 1. Check global cron functions
    log += 'typeof cronAdd=' + typeof cronAdd + ' | '
    log += 'typeof cronRemove=' + typeof cronRemove + ' | '

    // 2. Test app.cron() methods and invocation
    try {
      if (typeof app.cron === 'function') {
        const c = app.cron()
        log += 'app.cron() exists. keys=' + Object.keys(c).join(',') + ' | '

        try {
          c.add('test_job_1', '* * * * *', () => {
            console.log('[TEST CRON 1 EXECUTED]')
          })
          log += 'app.cron().add SUCCESS | '
        } catch (addErr) {
          log += 'app.cron().add ERR: ' + addErr + ' | '
        }

        try {
          c.mustAdd('test_job_2', '* * * * *', () => {
            console.log('[TEST CRON 2 EXECUTED]')
          })
          log += 'app.cron().mustAdd SUCCESS | '
        } catch (mustAddErr) {
          log += 'app.cron().mustAdd ERR: ' + mustAddErr + ' | '
        }

        try {
          log += 'c.total()=' + (typeof c.total === 'function' ? c.total() : 'no func') + ' | '
          if (typeof c.jobs === 'function') {
            const j = c.jobs()
            log += 'c.jobs() length=' + (j ? j.length : 'null') + ' | '
          }
        } catch (jErr) {
          log += 'jobs check err: ' + jErr + ' | '
        }
      } else {
        log += 'app.cron is NOT a function (' + typeof app.cron + ') | '
      }
    } catch (cronErr) {
      log += 'cron section err: ' + cronErr + ' | '
    }

    const rec = new Record(debugCol)
    rec.set('output', log)
    app.save(rec)
  },
  (app) => {},
)

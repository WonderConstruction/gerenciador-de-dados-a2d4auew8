migrate(
  (app) => {
    // Migration 0032: Clean up migration-level cron attempts and neutralize 0031
    // Cron scheduling is handled at the hooks level (pocketbase/hooks/telegram_auto_transactions.js)
    try {
      if (typeof app.cron === 'function') {
        const cronRunner = app.cron()
        if (typeof cronRunner.remove === 'function') {
          cronRunner.remove('telegram_cron_poller_31')
          cronRunner.remove('telegram_polling')
        }
      }
    } catch (_) {}
  },
  (app) => {},
)

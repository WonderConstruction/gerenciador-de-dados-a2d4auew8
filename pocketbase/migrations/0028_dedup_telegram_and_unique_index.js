migrate(
  (app) => {
    // 1. Delete duplicate telegram_messages and duplicate transactions
    // For update_id 633643829: keep the first (fhjz083lmk3qtrl / fd4p2416rscs114) and delete the duplicate (o34c59d109xa695 / t7ri8hziir5pcp7)
    try {
      app.db().newQuery("DELETE FROM transactions WHERE id = 't7ri8hziir5pcp7'").execute()
    } catch (_) {}

    try {
      app.db().newQuery("DELETE FROM telegram_messages WHERE id = 'o34c59d109xa695'").execute()
    } catch (_) {}

    // 2. Generic deduplication of telegram_messages by update_id if any other duplicates exist
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM telegram_messages WHERE id NOT IN (
          SELECT MIN(id) FROM telegram_messages GROUP BY update_id
        ) AND update_id IS NOT NULL AND update_id > 0
      `)
        .execute()
    } catch (_) {}

    // 3. Add UNIQUE index on telegram_messages.update_id to prevent any duplicate insertion
    try {
      const telegramCol = app.findCollectionByNameOrId('telegram_messages')
      telegramCol.addIndex(
        'idx_telegram_messages_update_id_unique',
        true,
        'update_id',
        'update_id > 0',
      )
      app.save(telegramCol)
    } catch (err) {
      console.log('[Migration 0028] Index error (non-fatal):', err)
    }
  },
  (app) => {
    try {
      const telegramCol = app.findCollectionByNameOrId('telegram_messages')
      telegramCol.removeIndex('idx_telegram_messages_update_id_unique')
      app.save(telegramCol)
    } catch (_) {}
  },
)

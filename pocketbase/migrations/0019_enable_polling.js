migrate(
  (app) => {
    // 1. Ensure telegram_messages createRule allows anonymous/public inserts
    const telegramMessagesCol = app.findCollectionByNameOrId('telegram_messages')
    telegramMessagesCol.createRule = '1=1'
    telegramMessagesCol.listRule = ''
    telegramMessagesCol.viewRule = ''
    telegramMessagesCol.updateRule = "@request.auth.id != ''"
    telegramMessagesCol.deleteRule = "@request.auth.id != ''"
    app.save(telegramMessagesCol)

    // 2. Create telegram_state collection for tracking offset and polling status
    if (!app.hasTable('telegram_state')) {
      const telegramStateCol = new Collection({
        name: 'telegram_state',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'key', type: 'text', required: true },
          { name: 'value', type: 'number' },
          { name: 'text_value', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_telegram_state_key ON telegram_state (key)'],
      })
      app.save(telegramStateCol)

      // Seed initial offset row if not exists
      try {
        const record = new Record(telegramStateCol)
        record.set('key', 'last_update_id')
        record.set('value', 0)
        app.save(record)
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const telegramStateCol = app.findCollectionByNameOrId('telegram_state')
      app.delete(telegramStateCol)
    } catch (_) {}
  },
)

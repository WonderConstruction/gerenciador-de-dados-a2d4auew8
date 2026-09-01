migrate(
  (app) => {
    // Create collection cron_test_logs for observable cronAdd verification
    const collection = new Collection({
      name: 'cron_test_logs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'timestamp', type: 'text', required: false },
        { name: 'message', type: 'text', required: false },
        { name: 'tick_count', type: 'number', required: false },
        { name: 'job_name', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_cron_test_logs_created ON cron_test_logs (created DESC)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('cron_test_logs')
      app.delete(collection)
    } catch (_) {}
  },
)

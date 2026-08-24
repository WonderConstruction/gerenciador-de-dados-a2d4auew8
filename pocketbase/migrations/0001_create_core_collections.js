migrate(
  (app) => {
    // 1. Obras collection
    const obrasCollection = new Collection({
      name: 'obras',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: '', // Permite visualização pública ou compartilhada por link
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'client_name', type: 'text' },
        { name: 'client_email', type: 'email' },
        { name: 'client_phone', type: 'text' },
        { name: 'total_budget', type: 'number', min: 0 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['planejamento', 'em_andamento', 'pausada', 'concluida'],
          maxSelect: 1,
        },
        { name: 'address', type: 'text' },
        { name: 'start_date', type: 'date' },
        { name: 'end_date', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'share_token', type: 'text' },
        { name: 'share_password', type: 'text' },
        { name: 'google_sheets_url', type: 'url' },
        { name: 'google_sheets_id', type: 'text' },
        { name: 'last_sheets_sync', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_obras_user ON obras (user_id)',
        'CREATE INDEX idx_obras_status ON obras (status)',
        'CREATE INDEX idx_obras_share ON obras (share_token)',
      ],
    })
    app.save(obrasCollection)

    const obrasId = obrasCollection.id

    // 2. Transactions collection
    const transactionsCollection = new Collection({
      name: 'transactions',
      type: 'base',
      listRule: "@request.auth.id != '' || obra_id.share_token != ''",
      viewRule: "@request.auth.id != '' || obra_id.share_token != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'obra_id',
          type: 'relation',
          required: true,
          collectionId: obrasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['income', 'expense'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true, min: 0 },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: [
            'frame',
            'labor',
            'electrical',
            'plumbing',
            'materials',
            'equipment',
            'finishing',
            'permits',
            'other',
          ],
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'date', type: 'date', required: true },
        { name: 'receipt_file', type: 'file', maxSelect: 1, maxSize: 10485760 },
        {
          name: 'source',
          type: 'select',
          values: ['manual', 'whatsapp', 'telegram', 'import'],
          maxSelect: 1,
        },
        { name: 'raw_bot_text', type: 'text' },
        { name: 'ocr_extracted_data', type: 'json' },
        { name: 'sheets_synced', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transactions_obra ON transactions (obra_id)',
        'CREATE INDEX idx_transactions_date ON transactions (date DESC)',
        'CREATE INDEX idx_transactions_category ON transactions (category)',
      ],
    })
    app.save(transactionsCollection)

    // 3. Bot Messages collection (logs/inbox for Telegram & WhatsApp webhook captures)
    const botMessagesCollection = new Collection({
      name: 'bot_messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // Webhook can create without auth if public endpoint or internal
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          values: ['telegram', 'whatsapp', 'simulated'],
          maxSelect: 1,
        },
        { name: 'sender_id', type: 'text' },
        { name: 'sender_name', type: 'text' },
        {
          name: 'obra_id',
          type: 'relation',
          collectionId: obrasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'media_file', type: 'file', maxSelect: 1, maxSize: 15728640 },
        { name: 'caption', type: 'text' },
        { name: 'suggested_category', type: 'text' },
        { name: 'suggested_amount', type: 'number' },
        { name: 'suggested_type', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['processed', 'pending_review', 'error'],
          maxSelect: 1,
        },
        {
          name: 'parsed_transaction_id',
          type: 'relation',
          collectionId: transactionsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'payload_raw', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_bot_msgs_created ON bot_messages (created DESC)'],
    })
    app.save(botMessagesCollection)

    // 4. Report Configs collection
    const reportConfigsCollection = new Collection({
      name: 'report_configs',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'recipient_email', type: 'email', required: true },
        { name: 'weekly_enabled', type: 'bool' },
        {
          name: 'weekly_day',
          type: 'select',
          values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          maxSelect: 1,
        },
        { name: 'weekly_hour', type: 'number', min: 0, max: 23, onlyInt: true },
        { name: 'monthly_enabled', type: 'bool' },
        { name: 'monthly_day', type: 'number', min: 1, max: 31, onlyInt: true },
        { name: 'monthly_hour', type: 'number', min: 0, max: 23, onlyInt: true },
        { name: 'include_all_obras', type: 'bool' },
        { name: 'telegram_notifications_enabled', type: 'bool' },
        { name: 'telegram_chat_id', type: 'text' },
        { name: 'last_weekly_sent', type: 'date' },
        { name: 'last_monthly_sent', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_report_user ON report_configs (user_id)'],
    })
    app.save(reportConfigsCollection)
  },
  (app) => {
    try {
      const reportConfigs = app.findCollectionByNameOrId('report_configs')
      app.delete(reportConfigs)
    } catch (_) {}
    try {
      const botMessages = app.findCollectionByNameOrId('bot_messages')
      app.delete(botMessages)
    } catch (_) {}
    try {
      const transactions = app.findCollectionByNameOrId('transactions')
      app.delete(transactions)
    } catch (_) {}
    try {
      const obras = app.findCollectionByNameOrId('obras')
      app.delete(obras)
    } catch (_) {}
  },
)

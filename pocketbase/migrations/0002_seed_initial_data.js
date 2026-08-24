migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Idempotent admin / demo user creation
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'obrunolimaus@gmail.com')
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('obrunolimaus@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Bruno Lima')
      app.save(adminUser)
    }

    const obrasCol = app.findCollectionByNameOrId('obras')
    const transactionsCol = app.findCollectionByNameOrId('transactions')
    const reportConfigsCol = app.findCollectionByNameOrId('report_configs')

    // Check if seed obras exist
    let obra1, obra2, obra3
    try {
      obra1 = app.findFirstRecordByData('obras', 'name', 'Residencial Alphaville - Casa 42')
    } catch (_) {
      obra1 = new Record(obrasCol)
      obra1.set('user_id', adminUser.id)
      obra1.set('name', 'Residencial Alphaville - Casa 42')
      obra1.set('client_name', 'Carlos Eduardo Silva')
      obra1.set('client_email', 'carlos.silva@alphaville.com')
      obra1.set('client_phone', '+55 (11) 98765-4321')
      obra1.set('total_budget', 350000)
      obra1.set('status', 'em_andamento')
      obra1.set('address', 'Alameda das Acácias, 420 - Barueri, SP')
      obra1.set('start_date', '2025-01-10 08:00:00.000Z')
      obra1.set('share_token', 'alphaville-c42-pub')
      obra1.set(
        'google_sheets_url',
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
      )
      obra1.set('notes', 'Construção residencial unifamiliar de alto padrão (320m²).')
      app.save(obra1)
    }

    try {
      obra2 = app.findFirstRecordByData(
        'obras',
        'name',
        'Edifício Comercial SkyTower - Conjunto 1402',
      )
    } catch (_) {
      obra2 = new Record(obrasCol)
      obra2.set('user_id', adminUser.id)
      obra2.set('name', 'Edifício Comercial SkyTower - Conjunto 1402')
      obra2.set('client_name', 'Mariana Vasconcelos')
      obra2.set('client_email', 'mariana@vasconcelosadv.com.br')
      obra2.set('client_phone', '+55 (11) 99123-8899')
      obra2.set('total_budget', 120000)
      obra2.set('status', 'em_andamento')
      obra2.set('address', 'Av. Brigadeiro Faria Lima, 2400 - Itaim Bibi, SP')
      obra2.set('start_date', '2025-02-01 08:00:00.000Z')
      obra2.set('share_token', 'skytower-1402-pub')
      obra2.set(
        'google_sheets_url',
        'https://docs.google.com/spreadsheets/d/1exampleSkyTowerSheetsID/edit',
      )
      obra2.set(
        'notes',
        'Reforma de escritório corporativo com infraestrutura elétrica e automação.',
      )
      app.save(obra2)
    }

    try {
      obra3 = app.findFirstRecordByData('obras', 'name', 'Reforma Villa Bella - Cozinha e Gourmet')
    } catch (_) {
      obra3 = new Record(obrasCol)
      obra3.set('user_id', adminUser.id)
      obra3.set('name', 'Reforma Villa Bella - Cozinha e Gourmet')
      obra3.set('client_name', 'Roberto & Helena Mendes')
      obra3.set('client_email', 'roberto.mendes@gmail.com')
      obra3.set('client_phone', '+55 (21) 97654-1122')
      obra3.set('total_budget', 85000)
      obra3.set('status', 'planejamento')
      obra3.set('address', 'Rua Visconde de Pirajá, 550 - Ipanema, RJ')
      obra3.set('start_date', '2025-03-01 08:00:00.000Z')
      obra3.set('share_token', 'villabella-gourmet-pub')
      obra3.set('notes', 'Modernização de área gourmet com bancadas de quartzo e marcenaria.')
      app.save(obra3)
    }

    // Seed sample transactions for Obra 1
    const countTx = app.countRecords('transactions')
    if (countTx === 0) {
      const sampleTransactions = [
        // Entradas Obra 1
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'income',
          amount: 100000,
          category: 'other',
          description: 'Aporte Inicial do Cliente (1ª Parcela Contrato)',
          date: '2025-01-10 10:00:00.000Z',
          source: 'manual',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'income',
          amount: 80000,
          category: 'other',
          description: '2ª Parcela Medição Estrutural',
          date: '2025-02-15 11:30:00.000Z',
          source: 'manual',
          sheets_synced: true,
        },

        // Saídas Obra 1
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 35000,
          category: 'frame',
          description: 'Vigas de aço e armação estrutural de concreto',
          date: '2025-01-15 14:20:00.000Z',
          source: 'whatsapp',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 18500,
          category: 'labor',
          description: 'Pagamento quinzenal equipe de alvenaria e mestre de obras',
          date: '2025-01-30 17:00:00.000Z',
          source: 'whatsapp',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 9400,
          category: 'materials',
          description: 'Compra de 150 sacos de cimento e 10m³ areia média',
          date: '2025-02-05 09:15:00.000Z',
          source: 'telegram',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 14200,
          category: 'electrical',
          description: 'Cabos 6mm, eletrodutos corrugados e quadros de distribuição Tigre',
          date: '2025-02-10 16:45:00.000Z',
          source: 'whatsapp',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 8800,
          category: 'plumbing',
          description: 'Tubulações de água fria/quente e conexões Aquatherm',
          date: '2025-02-18 11:10:00.000Z',
          source: 'manual',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 4500,
          category: 'equipment',
          description: 'Locação de betoneira e andaimes tubulares (mensal)',
          date: '2025-02-20 08:30:00.000Z',
          source: 'telegram',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 3200,
          category: 'permits',
          description: 'Taxa de alvará de construção e ART junto ao CREA',
          date: '2025-01-12 13:00:00.000Z',
          source: 'manual',
          sheets_synced: true,
        },
        {
          obra_id: obra1.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 12600,
          category: 'finishing',
          description: 'Revestimentos porcelanato Portobello 90x90 para living',
          date: '2025-02-24 15:20:00.000Z',
          source: 'whatsapp',
          sheets_synced: false,
        },

        // Entradas Obra 2
        {
          obra_id: obra2.id,
          user_id: adminUser.id,
          type: 'income',
          amount: 50000,
          category: 'other',
          description: 'Entrada contratação projeto corporativo',
          date: '2025-02-02 09:00:00.000Z',
          source: 'manual',
          sheets_synced: true,
        },

        // Saídas Obra 2
        {
          obra_id: obra2.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 16800,
          category: 'electrical',
          description: 'Luminárias em LED embutir e infraestrutura de rede fibra/dados',
          date: '2025-02-08 14:00:00.000Z',
          source: 'whatsapp',
          sheets_synced: true,
        },
        {
          obra_id: obra2.id,
          user_id: adminUser.id,
          type: 'expense',
          amount: 11500,
          category: 'labor',
          description: 'Empreiteiro de gesso acartonado e divisórias drywall',
          date: '2025-02-16 18:00:00.000Z',
          source: 'telegram',
          sheets_synced: true,
        },
      ]

      for (let i = 0; i < sampleTransactions.length; i++) {
        const item = sampleTransactions[i]
        const tx = new Record(transactionsCol)
        tx.set('obra_id', item.obra_id)
        tx.set('user_id', item.user_id)
        tx.set('type', item.type)
        tx.set('amount', item.amount)
        tx.set('category', item.category)
        tx.set('description', item.description)
        tx.set('date', item.date)
        tx.set('source', item.source)
        tx.set('sheets_synced', item.sheets_synced)
        app.save(tx)
      }
    }

    // Seed default report configuration for admin
    try {
      app.findFirstRecordByData('report_configs', 'user_id', adminUser.id)
    } catch (_) {
      const reportCfg = new Record(reportConfigsCol)
      reportCfg.set('user_id', adminUser.id)
      reportCfg.set('recipient_email', adminUser.getString('email'))
      reportCfg.set('weekly_enabled', true)
      reportCfg.set('weekly_day', 'monday')
      reportCfg.set('weekly_hour', 8)
      reportCfg.set('monthly_enabled', true)
      reportCfg.set('monthly_day', 1)
      reportCfg.set('monthly_hour', 8)
      reportCfg.set('include_all_obras', true)
      reportCfg.set('telegram_notifications_enabled', false)
      app.save(reportCfg)
    }
  },
  (app) => {
    // rollback seed if necessary
  },
)

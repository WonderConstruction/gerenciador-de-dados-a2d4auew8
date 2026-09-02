migrate(
  (app) => {
    // 1. Ensure telegram_state has open/manage rules for reading and updating polling offset
    try {
      const stateCol = app.findCollectionByNameOrId('telegram_state')
      stateCol.listRule = ''
      stateCol.viewRule = ''
      stateCol.createRule = ''
      stateCol.updateRule = ''
      stateCol.deleteRule = ''
      app.save(stateCol)
    } catch (e) {
      console.log('[Migration 0034] Error updating telegram_state rules:', e)
    }

    // 2. Ensure telegram_messages has open create/list/view/update rules so poller & sync can always manage messages
    try {
      const msgsCol = app.findCollectionByNameOrId('telegram_messages')
      msgsCol.listRule = ''
      msgsCol.viewRule = ''
      msgsCol.createRule = ''
      msgsCol.updateRule = ''
      msgsCol.deleteRule = ''
      app.save(msgsCol)
    } catch (e) {
      console.log('[Migration 0034] Error updating telegram_messages rules:', e)
    }

    // 3. Ensure bot_messages has open rules for bot simulation & ingestion
    try {
      const botMsgsCol = app.findCollectionByNameOrId('bot_messages')
      botMsgsCol.listRule = ''
      botMsgsCol.viewRule = ''
      botMsgsCol.createRule = ''
      botMsgsCol.updateRule = ''
      botMsgsCol.deleteRule = ''
      app.save(botMsgsCol)
    } catch (e) {
      console.log('[Migration 0034] Error updating bot_messages rules:', e)
    }

    // 4. Ensure transactions has open rules so telegram hook / bot can query and create transactions
    try {
      const txCol = app.findCollectionByNameOrId('transactions')
      txCol.listRule = ''
      txCol.viewRule = ''
      txCol.createRule = ''
      txCol.updateRule = ''
      txCol.deleteRule = ''
      app.save(txCol)
    } catch (e) {
      console.log('[Migration 0034] Error updating transactions rules:', e)
    }
  },
  (app) => {
    try {
      const stateCol = app.findCollectionByNameOrId('telegram_state')
      stateCol.listRule = ''
      stateCol.viewRule = ''
      stateCol.createRule = ''
      stateCol.updateRule = ''
      stateCol.deleteRule = "@request.auth.id != ''"
      app.save(stateCol)
    } catch (_) {}

    try {
      const msgsCol = app.findCollectionByNameOrId('telegram_messages')
      msgsCol.listRule = ''
      msgsCol.viewRule = ''
      msgsCol.createRule = ''
      msgsCol.updateRule = "@request.auth.id != ''"
      msgsCol.deleteRule = "@request.auth.id != ''"
      app.save(msgsCol)
    } catch (_) {}
  },
)

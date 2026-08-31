migrate(
  (app) => {
    // 1. Open up transactions collection rules so that updates / sync status changes
    // succeed whether authenticated or via client dashboard / public view
    try {
      const transactionsCol = app.findCollectionByNameOrId('transactions')
      transactionsCol.listRule = ''
      transactionsCol.viewRule = ''
      transactionsCol.createRule = ''
      transactionsCol.updateRule = ''
      transactionsCol.deleteRule = ''
      app.save(transactionsCol)
    } catch (e) {
      console.log('[Migration 0029] Error updating transactions rules:', e)
    }

    // 2. Open up obras collection rules so that last_sheets_sync timestamp and sheet ID updates succeed
    try {
      const obrasCol = app.findCollectionByNameOrId('obras')
      obrasCol.listRule = ''
      obrasCol.viewRule = ''
      obrasCol.createRule = ''
      obrasCol.updateRule = ''
      obrasCol.deleteRule = ''
      app.save(obrasCol)
    } catch (e) {
      console.log('[Migration 0029] Error updating obras rules:', e)
    }
  },
  (app) => {
    try {
      const transactionsCol = app.findCollectionByNameOrId('transactions')
      transactionsCol.listRule = "@request.auth.id != '' || obra_id.share_token != ''"
      transactionsCol.viewRule = "@request.auth.id != '' || obra_id.share_token != ''"
      transactionsCol.createRule = "@request.auth.id != ''"
      transactionsCol.updateRule = "@request.auth.id != ''"
      transactionsCol.deleteRule = "@request.auth.id != ''"
      app.save(transactionsCol)
    } catch (_) {}

    try {
      const obrasCol = app.findCollectionByNameOrId('obras')
      obrasCol.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
      obrasCol.viewRule = ''
      obrasCol.createRule = "@request.auth.id != ''"
      obrasCol.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
      obrasCol.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
      app.save(obrasCol)
    } catch (_) {}
  },
)

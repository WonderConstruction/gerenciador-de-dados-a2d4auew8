migrate(
  (app) => {
    // Ensure all necessary collections for telegram sync have open/public access rules
    const collectionsToOpen = [
      'telegram_state',
      'telegram_messages',
      'bot_messages',
      'transactions',
      'obras',
    ]
    for (const colName of collectionsToOpen) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = ''
        col.viewRule = ''
        col.createRule = ''
        col.updateRule = ''
        col.deleteRule = ''
        app.save(col)
        console.log(`[Migration 0035] Verified public access rules for ${colName}`)
      } catch (e) {
        console.log(`[Migration 0035] Error updating ${colName} rules:`, e)
      }
    }
  },
  (app) => {
    // Revert is optional
  },
)

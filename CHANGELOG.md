## Version 0.0.2

New features:

- **Nested Subcollections**: Support for watching documents at any depth using wildcards
  - Example: `users/{userId}/orders/{orderId}` watches all orders for all users
  - Parent document IDs are available in templates via `{{parentIds.wildcardName}}`

- **Rate Limiting**: Prevent notification spam during bulk operations
  - Configurable maximum notifications per time window
  - Uses Firestore transaction for accurate counting
  - Gracefully handles rate limit exceeded scenarios

- **Custom Message Templates**: Create personalized Slack messages
  - Access document fields: `{{doc.fieldName}}`, `{{doc.nested.field}}`
  - Compare update values: `{{before.field}}`, `{{after.field}}`
  - Reference parent documents: `{{parentIds.userId}}`
  - Basic context: `{{action}}`, `{{docId}}`, `{{collection}}`, `{{timestamp}}`

- **Improved Context**: Full document path and parent ID extraction

## Version 0.0.1

Initial release:

- Monitor Firestore collection for document changes
- Support for create, update, and delete events
- Configurable Slack notifications via incoming webhooks
- Option to include/exclude document data
- Changed field detection for update events
- Node.js 20 runtime support

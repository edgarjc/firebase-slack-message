# Firestore to Slack Notifications

A Firebase Extension that sends Slack notifications when documents are created, updated, or deleted in your Firestore collections.

## Features

- **Firestore Triggers**: Get notified on document create, update, and delete events
- **Nested Subcollections**: Watch documents at any depth using wildcards (e.g., `users/{userId}/orders/{orderId}`)
- **Rate Limiting**: Prevent notification spam during bulk operations
- **Custom Templates**: Create personalized Slack messages with document field placeholders
- **Change Detection**: See which fields changed on document updates

## Installation

### Prerequisites

- Firebase project on the Blaze (pay-as-you-go) plan
- A Slack workspace with an [Incoming Webhook](https://api.slack.com/messaging/webhooks)

### Install Locally

```bash
# Clone the repository
git clone https://github.com/edgarjc/firebase-slack-message.git
cd firebase-slack-message

# Install dependencies
cd functions && npm install && cd ..

# Install the extension to your project
firebase ext:install . --project YOUR_PROJECT_ID
```

## Configuration

During installation, you'll configure these parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `COLLECTION_PATH` | Firestore path to watch (supports wildcards) | `collection/{docId}` |
| `SLACK_WEBHOOK_URL` | Your Slack incoming webhook URL | Required |
| `NOTIFY_ON_CREATE` | Send notification on document create | `true` |
| `NOTIFY_ON_UPDATE` | Send notification on document update | `true` |
| `NOTIFY_ON_DELETE` | Send notification on document delete | `true` |
| `ENABLE_RATE_LIMITING` | Limit notifications to prevent spam | `false` |
| `RATE_LIMIT_COUNT` | Max notifications per window | `10` |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit time window | `60` |
| `USE_CUSTOM_TEMPLATE` | Use custom message template | `false` |
| `CUSTOM_TEMPLATE` | Your custom message template | - |
| `INCLUDE_DOCUMENT_DATA` | Include document data in notifications | `true` |
| `MAX_DATA_LENGTH` | Max characters of document data | `500` |

## Collection Path Examples

| Path | Description |
|------|-------------|
| `users/{docId}` | Watch all documents in `users` collection |
| `orders/{orderId}` | Watch all orders |
| `users/{userId}/orders/{orderId}` | Watch orders for all users |
| `shops/{shopId}/products/{productId}` | Watch products in all shops |

## Custom Message Templates

Create personalized Slack messages using placeholders:

### Available Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{action}}` | Event type: Created, Updated, or Deleted |
| `{{docId}}` | The document ID |
| `{{collection}}` | The collection name |
| `{{fullPath}}` | Full document path |
| `{{timestamp}}` | ISO timestamp of the event |
| `{{doc.fieldName}}` | Any field from the document |
| `{{doc.nested.field}}` | Nested field values |
| `{{before.fieldName}}` | Value before update (updates only) |
| `{{after.fieldName}}` | Value after update (updates only) |
| `{{parentIds.wildcardName}}` | Parent document IDs from path |

### Template Examples

**Order notification:**
```
:package: New order {{doc.orderId}} from {{doc.customerName}} - ${{doc.total}}
```

**User update:**
```
:bust_in_silhouette: User {{parentIds.userId}} updated: {{doc.name}} ({{doc.email}})
```

**Simple alert:**
```
:warning: Document {{action}} in {{collection}}: {{docId}}
```

## Rate Limiting

Enable rate limiting to prevent notification floods during bulk operations:

- Notifications exceeding the limit are logged but not sent to Slack
- Uses Firestore to track notification counts (stored in `_slack_notification_rate_limit` collection)
- Resets automatically after the configured time window

**Example:** With `RATE_LIMIT_COUNT=10` and `RATE_LIMIT_WINDOW_SECONDS=60`, only 10 notifications will be sent per minute.

## Default Notification Format

When not using a custom template, notifications include:

- Action type with emoji (Created, Updated, Deleted)
- Collection name and document ID
- Parent document context (for nested paths)
- Document data preview (if enabled)
- Changed fields list (for updates)
- Timestamp

## Slack Webhook Setup

1. Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Create a new Slack app or select an existing one
3. Enable Incoming Webhooks
4. Click "Add New Webhook to Workspace"
5. Select the channel for notifications
6. Copy the webhook URL for use during installation

## Development

```bash
# Install dependencies
cd functions && npm install

# Build TypeScript
npm run build

# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix
```

## Project Structure

```
firebase-slack-message/
├── extension.yaml          # Extension configuration
├── PREINSTALL.md          # Pre-installation documentation
├── POSTINSTALL.md         # Post-installation documentation
├── CHANGELOG.md           # Version history
└── functions/
    ├── src/
    │   └── index.ts       # Cloud Functions source
    ├── lib/               # Compiled JavaScript
    ├── package.json
    └── tsconfig.json
```

## Troubleshooting

**Not receiving notifications?**
- Verify your Slack webhook URL is correct
- Check that the collection path matches your Firestore structure
- Ensure the path ends with a wildcard like `{docId}`
- Review Cloud Functions logs in Firebase Console

**Notifications are delayed?**
- Normal for Cloud Functions cold starts
- Consider using minimum instances for lower latency

**Rate limit issues?**
- Check `_slack_notification_rate_limit` collection in Firestore
- Adjust rate limit settings in extension configuration

**Custom template not working?**
- Verify placeholder syntax: `{{doc.field}}`
- Check that field names match your document structure
- Use `{{doc.nested.field}}` for nested objects

## License

Apache-2.0

## Author

[edgarjc](https://github.com/edgarjc)

Use this extension to send Slack notifications when documents in your Firestore collection are created, updated, or deleted.

### How it works

This extension monitors a specified Firestore collection (including nested subcollections) for document changes. When a document is created, updated, or deleted (based on your configuration), a notification is sent to your Slack channel via an incoming webhook.

### Features

- **Nested Subcollections**: Watch documents at any depth using wildcards (e.g., `users/{userId}/orders/{orderId}`)
- **Rate Limiting**: Prevent notification spam during bulk operations
- **Custom Templates**: Create personalized Slack messages with document field placeholders
- **Flexible Events**: Choose which events trigger notifications (create, update, delete)

### Setup

Before installing this extension, you'll need:

1. **Slack Workspace**: Access to a Slack workspace where you want to receive notifications
2. **Incoming Webhook**: Create a Slack incoming webhook:
   - Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
   - Create a new app or select an existing one
   - Enable Incoming Webhooks
   - Create a new webhook URL for your desired channel
   - Copy the webhook URL for use during installation

### Collection Path Examples

The collection path supports wildcards for nested subcollections:

| Path | Description |
|------|-------------|
| `users/{docId}` | Watch all documents in the `users` collection |
| `orders/{orderId}` | Watch all documents in the `orders` collection |
| `users/{userId}/orders/{orderId}` | Watch orders subcollection for all users |
| `shops/{shopId}/products/{productId}` | Watch products in all shops |
| `org/{orgId}/teams/{teamId}/members/{memberId}` | Watch deeply nested members |

### Custom Message Templates

When using custom templates, you can use these placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{action}}` | The action type (Created, Updated, Deleted) |
| `{{docId}}` | The document ID |
| `{{collection}}` | The collection name |
| `{{fullPath}}` | Full document path |
| `{{timestamp}}` | ISO timestamp of the event |
| `{{doc.fieldName}}` | Any field from the document |
| `{{doc.nested.field}}` | Nested document fields |
| `{{before.fieldName}}` | Field value before update |
| `{{after.fieldName}}` | Field value after update |
| `{{parentIds.wildcardName}}` | Parent document IDs from path |

**Example Templates:**

```
:shopping_cart: New order {{doc.orderId}} from {{doc.customerName}} - ${{doc.total}}
```

```
:bust_in_silhouette: User {{parentIds.userId}} updated their profile: {{doc.name}}
```

```
:warning: Document deleted from {{collection}}: {{docId}}
```

### Rate Limiting

Enable rate limiting to prevent notification floods during bulk operations:

- **Rate Limit Count**: Maximum notifications per window (default: 10)
- **Rate Limit Window**: Time window in seconds (default: 60)

For example, with defaults, only 10 notifications will be sent per minute. Additional events are logged but not sent to Slack.

### Billing

This extension uses Cloud Functions and Firestore (for rate limiting), which may incur charges on the Blaze plan. See [Firebase pricing](https://firebase.google.com/pricing) for details.

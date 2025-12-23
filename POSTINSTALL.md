### Installation complete

You've successfully installed the **Firestore to Slack Notifications** extension.

### What's next?

1. **Test the integration**: Create, update, or delete a document in your configured collection to verify notifications are working.

2. **Check the logs**: If notifications aren't arriving, check the Cloud Functions logs in the Firebase console for any errors.

3. **Adjust settings**: You can reconfigure the extension at any time from the Firebase console.

### Current configuration

| Setting | Value |
|---------|-------|
| Collection Path | `${param:COLLECTION_PATH}` |
| Create notifications | ${param:NOTIFY_ON_CREATE} |
| Update notifications | ${param:NOTIFY_ON_UPDATE} |
| Delete notifications | ${param:NOTIFY_ON_DELETE} |
| Rate limiting | ${param:ENABLE_RATE_LIMITING} |
| Custom template | ${param:USE_CUSTOM_TEMPLATE} |
| Include document data | ${param:INCLUDE_DOCUMENT_DATA} |

### Using Nested Subcollections

If you configured a path like `users/{userId}/orders/{orderId}`, the extension will:

1. Watch ALL orders subcollections across ALL users
2. Include `userId` and `orderId` in the notification context
3. Allow you to reference `{{parentIds.userId}}` in custom templates

### Custom Template Placeholders

Use these placeholders in your custom template:

```
{{action}}              → Created, Updated, or Deleted
{{docId}}               → The document ID
{{collection}}          → The collection name
{{fullPath}}            → Full document path
{{timestamp}}           → Event timestamp
{{doc.fieldName}}       → Document field value
{{doc.nested.field}}    → Nested field value
{{before.fieldName}}    → Value before update
{{after.fieldName}}     → Value after update
{{parentIds.userId}}    → Parent document ID from path wildcard
```

### Rate Limiting

When enabled, rate limiting uses a Firestore collection (`_slack_notification_rate_limit`) to track notification counts. This collection is automatically managed by the extension.

- Notifications exceeding the limit are logged but not sent
- The rate limit resets after the configured window expires
- You can monitor skipped notifications in Cloud Functions logs

### Troubleshooting

**Not receiving notifications?**
- Verify your Slack webhook URL is correct
- Check that the collection path matches your Firestore structure
- Ensure the path ends with a wildcard like `{docId}`
- Review Cloud Functions logs for errors

**Notifications are delayed?**
- This is normal for Cloud Functions cold starts
- Consider using minimum instances for lower latency

**Rate limit issues?**
- Check `_slack_notification_rate_limit` collection in Firestore
- Adjust rate limit settings in extension configuration
- Review logs for "Rate limit exceeded" messages

**Custom template not working?**
- Verify placeholder syntax uses double curly braces: `{{doc.field}}`
- Check that field names match your document structure
- Use `{{doc.nested.field}}` for nested objects

### Resources

- [Slack Incoming Webhooks Documentation](https://api.slack.com/messaging/webhooks)
- [Firebase Extensions Documentation](https://firebase.google.com/docs/extensions)
- [Cloud Functions Pricing](https://firebase.google.com/pricing)

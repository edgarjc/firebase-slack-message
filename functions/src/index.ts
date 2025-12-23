import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

type DocumentAction = "Created" | "Updated" | "Deleted";

interface NotificationContext {
  action: DocumentAction;
  docId: string;
  fullPath: string;
  collection: string;
  parentIds: Record<string, string>;
  data?: admin.firestore.DocumentData | null;
  beforeData?: admin.firestore.DocumentData | null;
  timestamp: string;
}

interface RateLimitDoc {
  count: number;
  windowStart: admin.firestore.Timestamp;
}

const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  collectionPath: process.env.COLLECTION_PATH || "",
  notifyOnCreate: process.env.NOTIFY_ON_CREATE === "true",
  notifyOnUpdate: process.env.NOTIFY_ON_UPDATE === "true",
  notifyOnDelete: process.env.NOTIFY_ON_DELETE === "true",
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING === "true",
  rateLimitCount: parseInt(process.env.RATE_LIMIT_COUNT || "10", 10),
  rateLimitWindowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10),
  useCustomTemplate: process.env.USE_CUSTOM_TEMPLATE === "true",
  customTemplate: process.env.CUSTOM_TEMPLATE || "",
  includeDocumentData: process.env.INCLUDE_DOCUMENT_DATA === "true",
  maxDataLength: parseInt(process.env.MAX_DATA_LENGTH || "500", 10),
};

const RATE_LIMIT_COLLECTION = "_slack_notification_rate_limit";

/**
 * Check if we're within rate limits. Returns true if notification can be sent.
 */
async function checkRateLimit(): Promise<boolean> {
  if (!config.enableRateLimiting) {
    return true;
  }

  const now = admin.firestore.Timestamp.now();
  const windowStart = new Date(now.toMillis() - config.rateLimitWindowSeconds * 1000);
  const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc("current");

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const data = doc.data() as RateLimitDoc | undefined;

      if (!data || data.windowStart.toMillis() < windowStart.getTime()) {
        // Start a new window
        transaction.set(rateLimitRef, {
          count: 1,
          windowStart: now,
        });
        return true;
      }

      if (data.count >= config.rateLimitCount) {
        // Rate limit exceeded
        console.log(
          `Rate limit exceeded: ${data.count}/${config.rateLimitCount} ` +
          `in ${config.rateLimitWindowSeconds}s window`
        );
        return false;
      }

      // Increment counter
      transaction.update(rateLimitRef, {
        count: admin.firestore.FieldValue.increment(1),
      });
      return true;
    });

    return result;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Allow notification on error to avoid blocking
    return true;
  }
}

/**
 * Extract parent document IDs from the document path based on wildcards in config
 */
function extractParentIds(
  documentPath: string,
  configPath: string
): Record<string, string> {
  const parentIds: Record<string, string> = {};
  const configParts = configPath.split("/");
  const pathParts = documentPath.split("/");

  for (let i = 0; i < configParts.length && i < pathParts.length; i++) {
    const configPart = configParts[i];
    if (configPart.startsWith("{") && configPart.endsWith("}")) {
      const wildcardName = configPart.slice(1, -1);
      parentIds[wildcardName] = pathParts[i];
    }
  }

  return parentIds;
}

/**
 * Get the collection name from the path (last collection segment)
 */
function getCollectionName(documentPath: string): string {
  const parts = documentPath.split("/");
  // Collection is the second-to-last part (before the doc ID)
  return parts.length >= 2 ? parts[parts.length - 2] : documentPath;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Format a value for display in Slack message
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}

/**
 * Process custom template with placeholders
 */
function processTemplate(template: string, context: NotificationContext): string {
  let result = template;

  // Replace basic placeholders
  result = result.replace(/\{\{action\}\}/g, context.action);
  result = result.replace(/\{\{docId\}\}/g, context.docId);
  result = result.replace(/\{\{collection\}\}/g, context.collection);
  result = result.replace(/\{\{fullPath\}\}/g, context.fullPath);
  result = result.replace(/\{\{timestamp\}\}/g, context.timestamp);

  // Replace parentIds placeholders: {{parentIds.userId}}
  result = result.replace(/\{\{parentIds\.(\w+)\}\}/g, (_, key) => {
    return context.parentIds[key] || "";
  });

  // Replace doc field placeholders: {{doc.fieldName}} or {{doc.nested.field}}
  result = result.replace(/\{\{doc\.([\w.]+)\}\}/g, (_, path) => {
    if (!context.data) return "";
    const value = getNestedValue(context.data as Record<string, unknown>, path);
    return formatValue(value);
  });

  // Replace before field placeholders: {{before.fieldName}}
  result = result.replace(/\{\{before\.([\w.]+)\}\}/g, (_, path) => {
    if (!context.beforeData) return "";
    const value = getNestedValue(context.beforeData as Record<string, unknown>, path);
    return formatValue(value);
  });

  // Replace after field placeholders: {{after.fieldName}}
  result = result.replace(/\{\{after\.([\w.]+)\}\}/g, (_, path) => {
    if (!context.data) return "";
    const value = getNestedValue(context.data as Record<string, unknown>, path);
    return formatValue(value);
  });

  return result;
}

async function sendSlackNotification(context: NotificationContext): Promise<void> {
  const webhookUrl = config.slackWebhookUrl;

  if (!webhookUrl) {
    console.error("Slack webhook URL is not configured");
    return;
  }

  // Check rate limit
  const withinLimit = await checkRateLimit();
  if (!withinLimit) {
    console.log(`Skipping notification for ${context.docId} due to rate limiting`);
    return;
  }

  const message = config.useCustomTemplate ?
    buildCustomMessage(context) :
    buildDefaultMessage(context);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    console.log(`Slack notification sent for ${context.action} on ${context.fullPath}`);
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    throw error;
  }
}

function buildCustomMessage(context: NotificationContext): SlackMessage {
  const text = processTemplate(config.customTemplate, context);
  return {text};
}

function buildDefaultMessage(context: NotificationContext): SlackMessage {
  const emoji = getActionEmoji(context.action);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Document ${context.action}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Collection:*\n\`${context.collection}\``,
        },
        {
          type: "mrkdwn",
          text: `*Document ID:*\n\`${context.docId}\``,
        },
      ],
    },
  ];

  // Add parent IDs if present
  const parentIdEntries = Object.entries(context.parentIds);
  if (parentIdEntries.length > 1) { // More than just the doc ID
    const parentFields = parentIdEntries
      .filter(([key]) => key !== "docId")
      .map(([key, value]) => `\`${key}\`: ${value}`)
      .join(", ");

    if (parentFields) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Path Context:*\n${parentFields}`,
        },
      });
    }
  }

  if (config.includeDocumentData && context.data) {
    const dataPreview = formatDocumentData(context.data);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Document Data:*\n\`\`\`${dataPreview}\`\`\``,
      },
    });
  }

  if (context.action === "Updated" && context.beforeData && config.includeDocumentData) {
    const changes = getChangedFields(context.beforeData, context.data || {});
    if (changes.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Changed Fields:*\n${changes.join("\n")}`,
        },
      });
    }
  }

  blocks.push({
    type: "context",
    text: {
      type: "mrkdwn",
      text: `Triggered at ${context.timestamp}`,
    },
  } as SlackBlock);

  return {blocks};
}

function getActionEmoji(action: DocumentAction): string {
  switch (action) {
  case "Created":
    return ":new:";
  case "Updated":
    return ":pencil2:";
  case "Deleted":
    return ":wastebasket:";
  default:
    return ":bell:";
  }
}

function formatDocumentData(data: admin.firestore.DocumentData): string {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    if (jsonString.length > config.maxDataLength) {
      return jsonString.substring(0, config.maxDataLength) + "\n... (truncated)";
    }
    return jsonString;
  } catch {
    return "[Unable to serialize document data]";
  }
}

function getChangedFields(
  before: admin.firestore.DocumentData,
  after: admin.firestore.DocumentData
): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = JSON.stringify(before[key]);
    const afterValue = JSON.stringify(after[key]);

    if (beforeValue !== afterValue) {
      if (!(key in before)) {
        changes.push(`  :heavy_plus_sign: \`${key}\` added`);
      } else if (!(key in after)) {
        changes.push(`  :heavy_minus_sign: \`${key}\` removed`);
      } else {
        changes.push(`  :arrows_counterclockwise: \`${key}\` changed`);
      }
    }
  }

  return changes;
}

function createContext(
  action: DocumentAction,
  documentPath: string,
  params: Record<string, string>,
  data?: admin.firestore.DocumentData | null,
  beforeData?: admin.firestore.DocumentData | null
): NotificationContext {
  const parentIds = extractParentIds(documentPath, config.collectionPath);

  // Also include all params as parent IDs
  Object.assign(parentIds, params);

  // Get the last segment as docId
  const pathParts = documentPath.split("/");
  const docId = pathParts[pathParts.length - 1];

  return {
    action,
    docId,
    fullPath: documentPath,
    collection: getCollectionName(documentPath),
    parentIds,
    data,
    beforeData,
    timestamp: new Date().toISOString(),
  };
}

export const onDocumentCreated = functions.firestore
  .document(config.collectionPath)
  .onCreate(async (snapshot, context) => {
    if (!config.notifyOnCreate) {
      console.log("Create notifications disabled, skipping");
      return;
    }

    const notificationContext = createContext(
      "Created",
      snapshot.ref.path,
      context.params,
      snapshot.data()
    );

    await sendSlackNotification(notificationContext);
  });

export const onDocumentUpdated = functions.firestore
  .document(config.collectionPath)
  .onUpdate(async (change, context) => {
    if (!config.notifyOnUpdate) {
      console.log("Update notifications disabled, skipping");
      return;
    }

    const notificationContext = createContext(
      "Updated",
      change.after.ref.path,
      context.params,
      change.after.data(),
      change.before.data()
    );

    await sendSlackNotification(notificationContext);
  });

export const onDocumentDeleted = functions.firestore
  .document(config.collectionPath)
  .onDelete(async (snapshot, context) => {
    if (!config.notifyOnDelete) {
      console.log("Delete notifications disabled, skipping");
      return;
    }

    const notificationContext = createContext(
      "Deleted",
      snapshot.ref.path,
      context.params,
      snapshot.data()
    );

    await sendSlackNotification(notificationContext);
  });

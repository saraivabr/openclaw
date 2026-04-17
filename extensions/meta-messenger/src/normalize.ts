import type { MetaInboundMessage, MetaWebhookPayload, MetaWebhookMessagingEntry } from "./types.js";

/**
 * Extract a human-readable text body from a messaging entry.
 * Handles text messages, postbacks, and attachment placeholders.
 */
export function extractMetaMessageBody(entry: MetaWebhookMessagingEntry): string {
  if (entry.message?.text?.trim()) {
    return entry.message.text.trim();
  }
  if (entry.postback?.title?.trim()) {
    return entry.postback.title.trim();
  }
  const attachments = entry.message?.attachments ?? [];
  if (attachments.length > 0) {
    const labels = attachments.map((att) => {
      if (att.payload?.url) {
        return `<media:${att.type}>`;
      }
      if (att.type === "sticker" && att.payload?.sticker_id) {
        return "<sticker>";
      }
      return `<${att.type}>`;
    });
    return labels.join(" ");
  }
  return "";
}

/**
 * Extract attachment URLs from a messaging entry.
 */
export function extractMetaAttachmentUrls(entry: MetaWebhookMessagingEntry): string[] | undefined {
  const urls = (entry.message?.attachments ?? [])
    .map((att) => att.payload?.url)
    .filter((url): url is string => Boolean(url));
  return urls.length > 0 ? urls : undefined;
}

/**
 * Normalize a raw Meta webhook payload into a flat list of inbound messages.
 * Handles both Messenger (object: "page") and Instagram (object: "instagram") payloads.
 */
export function normalizeMetaWebhookPayload(payload: MetaWebhookPayload): MetaInboundMessage[] {
  const platform: "messenger" | "instagram" =
    payload.object === "instagram" ? "instagram" : "messenger";
  const messages: MetaInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    // Standard Messenger / Instagram webhook uses entry.messaging
    for (const msg of entry.messaging ?? []) {
      // Only process actual messages (not echo from the page itself, etc.)
      if (!msg.message && !msg.postback) {
        continue;
      }
      const body = extractMetaMessageBody(msg);
      if (!body) {
        continue;
      }
      const messageId = msg.message?.mid ?? `${entry.id}-${msg.timestamp}`;
      messages.push({
        id: messageId,
        platform,
        senderId: msg.sender.id,
        recipientId: msg.recipient.id,
        body,
        timestamp: msg.timestamp,
        attachmentUrls: extractMetaAttachmentUrls(msg),
        raw: msg,
      });
    }
  }

  return messages;
}

/**
 * Normalize a sender ID (PSID / IGSID) to a canonical routing target.
 */
export function normalizeMetaSenderId(senderId: string): string {
  return senderId.trim();
}

/**
 * Check whether a string looks like a Meta PSID / IGSID.
 * Meta IDs are numeric strings (up to ~20 digits).
 */
export function looksLikeMetaTargetId(id: string | null | undefined): boolean {
  const trimmed = id?.trim();
  if (!trimmed) {
    return false;
  }
  return /^\d{5,25}$/.test(trimmed);
}

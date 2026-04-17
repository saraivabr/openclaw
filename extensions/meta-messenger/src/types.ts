/** Configuration types for the Meta Messenger / Instagram plugin. */

export type MetaTokenSource = "config" | "env" | "none";

/** Per-account and base-level config fields. */
interface MetaMessengerAccountBaseConfig {
  enabled?: boolean;
  name?: string;
  /** Meta Page Access Token (long-lived or system user token). */
  pageAccessToken?: string;
  /** Meta App Secret for validating webhook signatures. */
  appSecret?: string;
  /** Token used to verify the webhook subscription with Meta. */
  webhookVerifyToken?: string;
  /** The Page ID associated with this account. */
  pageId?: string;
  /** Allow-list of sender PSIDs/IGSIDs (direct message senders). */
  allowFrom?: Array<string | number>;
  /** DM access policy. */
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  /** Webhook listener port (when this plugin hosts its own HTTP listener). */
  webhookPort?: number;
  /** Webhook path override. */
  webhookPath?: string;
}

export interface MetaMessengerConfig extends MetaMessengerAccountBaseConfig {
  accounts?: Record<string, MetaMessengerAccountConfig>;
  defaultAccount?: string;
}

export interface MetaMessengerAccountConfig extends MetaMessengerAccountBaseConfig {}

export interface ResolvedMetaMessengerAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  pageAccessToken: string;
  tokenSource: MetaTokenSource;
  appSecret: string;
  webhookVerifyToken: string;
  pageId: string;
  config: MetaMessengerConfig & MetaMessengerAccountConfig;
}

/** Normalized representation of an inbound Meta message. */
export interface MetaInboundMessage {
  /** Unique message ID from Meta. */
  id: string;
  /** Platform: "messenger" or "instagram". */
  platform: "messenger" | "instagram";
  /** Sender PSID (Messenger) or IGSID (Instagram). */
  senderId: string;
  /** Recipient page/account ID. */
  recipientId: string;
  /** Plain text body extracted from the message. */
  body: string;
  /** Timestamp from Meta (Unix ms). */
  timestamp: number;
  /** Optional attachment URLs. */
  attachmentUrls?: string[];
  /** Original raw Meta event payload. */
  raw: MetaWebhookMessagingEntry;
}

/** Raw Meta webhook payload types. */
export interface MetaWebhookPayload {
  object: "page" | "instagram";
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  time: number;
  messaging?: MetaWebhookMessagingEntry[];
  changes?: MetaWebhookChange[];
}

export interface MetaWebhookMessagingEntry {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload?: { url?: string; sticker_id?: number };
    }>;
    reply_to?: { mid: string };
  };
  postback?: { title: string; payload: string };
  referral?: { ref: string; source: string; type: string };
}

export interface MetaWebhookChange {
  field: string;
  value: unknown;
}

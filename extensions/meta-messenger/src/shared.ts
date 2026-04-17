/** Channel IDs for Meta channels. */
export const META_MESSENGER_CHANNEL = "messenger" as const;
export const META_INSTAGRAM_CHANNEL = "instagram" as const;
export const META_PLUGIN_ID = "meta-messenger" as const;

export const DEFAULT_ACCOUNT_ID = "default";

/** Meta Graph API base URL. */
export const META_GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

/** Default webhook path for Meta Graph API events. */
export const META_WEBHOOK_PATH = "/webhook/meta";

/** Default health path. */
export const META_HEALTH_PATH = "/healthz";

/** Default port for the Meta webhook listener. */
export const META_WEBHOOK_DEFAULT_PORT = 8789;

/** Maximum body bytes accepted from Meta webhooks. */
export const META_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

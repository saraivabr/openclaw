---
summary: "Facebook Messenger and Instagram DMs channel via Meta Graph API webhook"
read_when:
  - Setting up Messenger or Instagram DMs with OpenClaw
  - Building a real estate SDR bot on Meta platforms
title: "Meta Messenger / Instagram"
---

# Meta Messenger / Instagram

Status: plugin (`@openclaw/meta-messenger`). Receives messages via Meta Graph API webhook.

<CardGroup cols={2}>
  <Card title="Pairing" icon="link" href="/channels/pairing">
    Default DM policy is pairing for unknown senders.
  </Card>
  <Card title="Gateway configuration" icon="settings" href="/gateway/configuration">
    Full channel config patterns and examples.
  </Card>
</CardGroup>

## Overview

The `meta-messenger` plugin handles:

- **Facebook Messenger**: DMs to your Facebook Page via `messages` webhook event
- **Instagram DMs**: DMs to your Instagram Business Account via `instagram` webhook event

Both share the same webhook endpoint (`POST /webhook/meta`) and configuration block.

## Prerequisites

1. A **Meta Developer App** at [developers.facebook.com](https://developers.facebook.com/apps/)
2. **Messenger** and/or **Instagram** products added to your app
3. A **Page Access Token** (generated from your Facebook Page)
4. A **Webhook Verify Token** (a secret string you invent)
5. Your gateway exposed over HTTPS (Fly.io, Railway, VPS, or ngrok for dev)

## Quick setup

<Steps>
  <Step title="Install the plugin">

```bash
openclaw plugins install @openclaw/meta-messenger
```

  </Step>
  <Step title="Configure via setup wizard">

```bash
openclaw setup meta-messenger
```

Or configure manually in `openclaw.json`:

```json5
{
  channels: {
    "meta-messenger": {
      enabled: true,
      pageAccessToken: "EAAxxxxxxx",
      webhookVerifyToken: "my-secret-verify-token",
      // Optional: Meta App Secret for webhook signature verification
      appSecret: "xxxxxxxx",
      allowFrom: ["*"],
    },
  },
}
```

  </Step>
  <Step title="Register the webhook in Meta for Developers">

In your Meta App Dashboard:

1. Go to **Messenger** → **Webhooks** (or **Instagram** → **Webhooks**)
2. Set the **Callback URL**: `https://<gateway-host>/webhook/meta`
3. Set the **Verify Token**: same value as `webhookVerifyToken`
4. Subscribe to the **`messages`** field

  </Step>
  <Step title="Start the gateway">

```bash
openclaw gateway run
```

The webhook server starts on port `3000` by default (configurable via `webhookPort`).

  </Step>
</Steps>

## Environment variables

| Variable                    | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `META_PAGE_ACCESS_TOKEN`    | Page Access Token (preferred over config file) |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook Verify Token                           |
| `META_APP_SECRET`           | App Secret (for HMAC signature verification)   |

## Configuration reference

```json5
{
  channels: {
    "meta-messenger": {
      enabled: true,

      // Meta Page Access Token
      pageAccessToken: "EAAxxxxxxx",

      // Meta App Secret (optional, enables webhook signature check)
      appSecret: "xxxxxxxx",

      // Webhook verify token (must match Meta App Dashboard setting)
      webhookVerifyToken: "my-secret-verify-token",

      // Your Facebook Page ID (optional, informational)
      pageId: "123456789",

      // Webhook server port (default: 3000)
      webhookPort: 3000,

      // Webhook HTTP path (default: /webhook/meta)
      webhookPath: "/webhook/meta",

      // DM access policy: "open" | "allowlist" | "pairing" | "disabled"
      dmPolicy: "open",

      // Allowed senders: ["*"] = all, or list specific PSIDs/IGSIDs
      allowFrom: ["*"],
    },
  },
}
```

## Multi-account setup

To handle multiple Facebook Pages or Instagram accounts, use the `accounts` object:

```json5
{
  channels: {
    "meta-messenger": {
      defaultAccount: "page-a",
      accounts: {
        "page-a": {
          enabled: true,
          pageAccessToken: "EAAxxxxxx-page-a",
          webhookVerifyToken: "verify-token-a",
          allowFrom: ["*"],
        },
        "page-b": {
          enabled: true,
          pageAccessToken: "EAAxxxxxx-page-b",
          webhookVerifyToken: "verify-token-b",
          allowFrom: ["*"],
        },
      },
    },
  },
}
```

## SDR imobiliário example

See [skills/sdr-imoveis](/skills/sdr-imoveis) for a complete real estate SDR persona that works across WhatsApp, Messenger, and Instagram DMs.

Example `openclaw.json` for a multi-channel SDR:

```json5
{
  identity: {
    name: "Ana",
    emoji: "🏠",
    bio: "Consultora imobiliária — qualifica leads e agenda visitas",
  },
  messages: {
    requireMention: false,
  },
  channels: {
    whatsapp: {
      enabled: true,
      allowFrom: ["*"],
      dmPolicy: "open",
    },
    "meta-messenger": {
      enabled: true,
      pageAccessToken: "${META_PAGE_ACCESS_TOKEN}",
      webhookVerifyToken: "${META_WEBHOOK_VERIFY_TOKEN}",
      allowFrom: ["*"],
      dmPolicy: "open",
    },
  },
  agents: {
    default: {
      skills: ["sdr-imoveis"],
    },
  },
}
```

## Troubleshooting

**Webhook verification fails (400/403)**

- Verify token in config must match exactly what you set in Meta App Dashboard
- Check that the webhook URL uses HTTPS

**Messages not delivered**

- Confirm `messages` field is subscribed in the webhook settings
- Check that `allowFrom` includes the sender's PSID/IGSID or is set to `["*"]`

**Page Access Token expired**

- Re-generate a long-lived token from the Meta Graph Explorer
- Update `pageAccessToken` in config

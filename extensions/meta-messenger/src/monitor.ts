import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { normalizeMetaWebhookPayload } from "./normalize.js";
import { sendMetaTextMessage, sendMetaSenderAction } from "./outbound.js";
import { META_PLUGIN_ID, META_WEBHOOK_DEFAULT_PORT, META_WEBHOOK_PATH } from "./shared.js";
import type { MetaInboundMessage, MetaWebhookPayload } from "./types.js";
import { startMetaWebhookServer } from "./webhook.js";

export interface MonitorMetaProviderOptions {
  pageAccessToken: string;
  appSecret?: string;
  webhookVerifyToken: string;
  accountId?: string;
  config: OpenClawConfig;
  /** Generic runtime environment (log, error helpers). */
  runtime: { log?: (msg: string) => void; error?: (msg: string) => void };
  abortSignal?: AbortSignal;
  webhookPath?: string;
  webhookPort?: number;
}

export interface MetaProviderMonitor {
  stop: () => void;
}

/**
 * Start monitoring Facebook Messenger and Instagram DM events
 * from the Meta Graph API webhook.
 *
 * For each inbound message, dispatches through the OpenClaw auto-reply
 * system (via `channelRuntime`) and delivers the response back via the
 * Meta Send API.
 *
 * @param channelRuntime - The channel runtime helpers injected via ctx.channelRuntime.
 */
export async function startMetaWebhookMonitor(
  channelRuntime: PluginRuntime["channel"],
  opts: MonitorMetaProviderOptions,
): Promise<MetaProviderMonitor> {
  const resolvedAccountId = opts.accountId ?? "default";
  const port = opts.webhookPort ?? META_WEBHOOK_DEFAULT_PORT;
  const path = opts.webhookPath ?? META_WEBHOOK_PATH;
  const token = opts.pageAccessToken.trim();
  const log = opts.runtime.log ?? (() => undefined);

  if (!token) {
    throw new Error("Meta Messenger webhook requires a non-empty pageAccessToken.");
  }
  if (!opts.webhookVerifyToken.trim()) {
    throw new Error("Meta Messenger webhook requires a non-empty webhookVerifyToken.");
  }

  /**
   * Handle a single normalized inbound Meta message.
   * Resolves the agent route, builds the context payload, dispatches to
   * the OpenClaw auto-reply system, and delivers the reply via Meta Send API.
   */
  async function handleInboundMessage(msg: MetaInboundMessage): Promise<void> {
    const from = msg.senderId;
    const rawBody = msg.body.trim();
    if (!rawBody) {
      return;
    }

    // Best-effort typing indicator (non-blocking).
    void sendMetaSenderAction(from, "typing_on", token).catch(() => undefined);

    try {
      const route = channelRuntime.routing.resolveAgentRoute({
        cfg: opts.config,
        channel: META_PLUGIN_ID,
        accountId: resolvedAccountId,
        peer: { kind: "direct", id: from },
      });

      const storePath = channelRuntime.session.resolveStorePath(opts.config.session?.store, {
        agentId: route.agentId,
      });

      const envelopeOptions = channelRuntime.reply.resolveEnvelopeFormatOptions(opts.config);
      const previousTimestamp = channelRuntime.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey,
      });

      const channelLabel = msg.platform === "instagram" ? "Instagram" : "Messenger";
      const body = channelRuntime.reply.formatAgentEnvelope({
        channel: channelLabel,
        from: `meta:${from}`,
        timestamp: msg.timestamp,
        previousTimestamp,
        envelope: envelopeOptions,
        body: rawBody,
      });

      const ctxPayload = channelRuntime.reply.finalizeInboundContext({
        Body: body,
        RawBody: rawBody,
        CommandBody: rawBody,
        From: `${META_PLUGIN_ID}:${from}`,
        To: `${META_PLUGIN_ID}:${resolvedAccountId}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: "direct",
        SenderName: from,
        SenderId: from,
        Provider: META_PLUGIN_ID,
        Surface: msg.platform,
        MessageSid: msg.id,
        Timestamp: msg.timestamp,
        OriginatingChannel: META_PLUGIN_ID,
        OriginatingTo: `${META_PLUGIN_ID}:${from}`,
        CommandAuthorized: false,
      });

      await channelRuntime.session.recordInboundSession({
        storePath,
        sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => log(`[meta-messenger] session record error: ${String(err)}`),
      });

      await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: opts.config,
        dispatcherOptions: {
          deliver: async (payload, _info) => {
            const text = payload.text ?? "";
            if (!text.trim()) {
              return;
            }
            const chunks = chunkText(text, 2000);
            for (const chunk of chunks) {
              await sendMetaTextMessage(from, chunk, token);
            }
          },
          onError: (err: unknown, info: { kind: string }) => {
            log(`[meta-messenger] ${info.kind} reply failed: ${String(err)}`);
          },
        },
      });
    } catch (err) {
      log(`[meta-messenger] dispatch error: ${String(err)}`);
    }
  }

  const { stop: stopWebhook } = await startMetaWebhookServer({
    verifyToken: opts.webhookVerifyToken,
    appSecret: opts.appSecret,
    path,
    port,
    log,
    onPayload: async (payload: MetaWebhookPayload) => {
      const messages = normalizeMetaWebhookPayload(payload);
      for (const msg of messages) {
        await handleInboundMessage(msg);
      }
    },
  });

  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", stopWebhook, { once: true });
  }

  return { stop: stopWebhook };
}

/** Split text into chunks no longer than maxLength. */
function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + maxLength));
    offset += maxLength;
  }
  return chunks;
}

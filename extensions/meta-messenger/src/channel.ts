import {
  createScopedAccountConfigAccessors,
  createScopedChannelConfigBase,
  createScopedDmSecurityResolver,
} from "openclaw/plugin-sdk/channel-config-helpers";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
} from "openclaw/plugin-sdk/core";
import {
  listMetaMessengerAccountIds,
  resolveDefaultMetaMessengerAccountId,
  resolveMetaMessengerAccount,
  normalizeAccountId,
} from "./accounts.js";
import { MetaMessengerConfigSchema } from "./config-schema.js";
import { startMetaWebhookMonitor } from "./monitor.js";
import { looksLikeMetaTargetId, normalizeMetaSenderId } from "./normalize.js";
import { sendMetaTextMessage } from "./outbound.js";
import { getMetaMessengerRuntime } from "./runtime.js";
import { metaMessengerSetupAdapter } from "./setup-core.js";
import { metaMessengerSetupWizard } from "./setup-surface.js";
import { META_PLUGIN_ID } from "./shared.js";
import type { ResolvedMetaMessengerAccount, MetaMessengerConfig } from "./types.js";

const metaConfigAccessors = createScopedAccountConfigAccessors({
  resolveAccount: ({ cfg, accountId }) => resolveMetaMessengerAccount({ cfg, accountId }),
  resolveAllowFrom: (account: ResolvedMetaMessengerAccount) => account.config.allowFrom,
  formatAllowFrom: (allowFrom) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean),
});

const metaConfigBase = createScopedChannelConfigBase<ResolvedMetaMessengerAccount>({
  sectionKey: META_PLUGIN_ID,
  listAccountIds: (cfg) => listMetaMessengerAccountIds(cfg),
  resolveAccount: (cfg, accountId) => resolveMetaMessengerAccount({ cfg, accountId }),
  defaultAccountId: (cfg) => resolveDefaultMetaMessengerAccountId(cfg),
  clearBaseFields: ["pageAccessToken", "appSecret", "webhookVerifyToken"],
});

const resolveMetaDmPolicy = createScopedDmSecurityResolver<ResolvedMetaMessengerAccount>({
  channelKey: META_PLUGIN_ID,
  resolvePolicy: (account) => account.config.dmPolicy,
  resolveAllowFrom: (account) => account.config.allowFrom,
  policyPathSuffix: "dmPolicy",
  approveHint: `openclaw pairing approve ${META_PLUGIN_ID} <senderId>`,
});

export const metaMessengerPlugin: ChannelPlugin<ResolvedMetaMessengerAccount> = {
  id: META_PLUGIN_ID,
  meta: {
    id: META_PLUGIN_ID,
    label: "Meta Messenger / Instagram",
    selectionLabel: "Messenger + Instagram (Meta Graph API)",
    detailLabel: "Meta Bot",
    docsPath: "/channels/meta-messenger",
    docsLabel: "meta-messenger",
    blurb: "Facebook Messenger and Instagram DMs via Meta Graph API webhook.",
    systemImage: "message.badge.filled.fill",
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: [`channels.${META_PLUGIN_ID}`] },
  configSchema: buildChannelConfigSchema(MetaMessengerConfigSchema),
  setupWizard: metaMessengerSetupWizard,
  pairing: {
    idLabel: "metaSenderId",
    normalizeAllowEntry: (entry) => String(entry).trim(),
  },
  config: {
    ...metaConfigBase,
    isConfigured: (account) =>
      Boolean(account.pageAccessToken.trim() && account.webhookVerifyToken.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.pageAccessToken.trim() && account.webhookVerifyToken.trim()),
      tokenSource: account.tokenSource ?? undefined,
    }),
    ...metaConfigAccessors,
  },
  security: {
    resolveDmPolicy: resolveMetaDmPolicy,
    collectWarnings: () => [],
  },
  messaging: {
    normalizeTarget: (target) => normalizeMetaSenderId(target),
    targetResolver: {
      looksLikeId: looksLikeMetaTargetId,
      hint: "<psid|igsid>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },
  setup: metaMessengerSetupAdapter,
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getMetaMessengerRuntime().channel.text.chunkText(text, limit),
    textChunkLimit: 2000,
    sendPayload: async ({ to, payload, accountId, cfg }) => {
      const account = resolveMetaMessengerAccount({ cfg, accountId });
      const token = account.pageAccessToken;
      if (!token) {
        throw new Error(
          `Meta Messenger: pageAccessToken not configured for account "${accountId ?? DEFAULT_ACCOUNT_ID}"`,
        );
      }
      const text = payload.text ?? "";
      const chunks = text ? getMetaMessengerRuntime().channel.text.chunkText(text, 2000) : [];

      let lastMessageId = "";
      for (const chunk of chunks) {
        const result = await sendMetaTextMessage(to, chunk, token);
        lastMessageId = result.messageId;
      }
      return {
        channel: META_PLUGIN_ID,
        messageId: lastMessageId || "empty",
        chatId: to,
      };
    },
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveMetaMessengerAccount({ cfg, accountId });
      const token = account.pageAccessToken;
      if (!token) {
        throw new Error(
          `Meta Messenger: pageAccessToken not configured for account "${accountId ?? DEFAULT_ACCOUNT_ID}"`,
        );
      }
      const result = await sendMetaTextMessage(to, text, token);
      return {
        channel: META_PLUGIN_ID,
        messageId: result.messageId,
        chatId: to,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) => {
      const issues: Array<{
        channel: string;
        accountId: string;
        kind: "config";
        message: string;
      }> = [];
      for (const account of accounts) {
        const accountId = account.accountId ?? DEFAULT_ACCOUNT_ID;
        if (!account.configured) {
          issues.push({
            channel: META_PLUGIN_ID,
            accountId,
            kind: "config",
            message: "Meta Messenger page token or webhook verify token not configured",
          });
        }
      }
      // ChannelStatusIssue is not exported from plugin-sdk; cast is safe here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return issues as any;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => {
      const configured = Boolean(
        account.pageAccessToken?.trim() && account.webhookVerifyToken?.trim(),
      );
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled ?? false,
        configured,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.pageAccessToken.trim();
      const verifyToken = account.webhookVerifyToken.trim();

      if (!token) {
        throw new Error(
          `Meta Messenger webhook requires a pageAccessToken for account "${account.accountId}".`,
        );
      }
      if (!verifyToken) {
        throw new Error(
          `Meta Messenger webhook requires a webhookVerifyToken for account "${account.accountId}".`,
        );
      }

      ctx.log?.info(`[${account.accountId}] starting Meta Messenger/Instagram webhook provider`);

      // Use ctx.channelRuntime (external plugin surface) if available,
      // otherwise fall back to the registered PluginRuntime.channel.
      const channelRuntime = ctx.channelRuntime ?? getMetaMessengerRuntime().channel;

      return startMetaWebhookMonitor(channelRuntime, {
        pageAccessToken: token,
        appSecret: account.appSecret,
        webhookVerifyToken: verifyToken,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        webhookPath: account.config.webhookPath,
        webhookPort: account.config.webhookPort,
      });
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const nextCfg = { ...cfg };
      const root = (cfg.channels?.["meta-messenger"] ?? {}) as MetaMessengerConfig;
      const nid = normalizeAccountId(accountId);
      let cleared = false;

      if (nid === DEFAULT_ACCOUNT_ID) {
        const nextRoot = { ...root } as Record<string, unknown>;
        if (nextRoot.pageAccessToken) {
          delete nextRoot.pageAccessToken;
          cleared = true;
        }
        return {
          cfg: {
            ...nextCfg,
            channels: { ...nextCfg.channels, "meta-messenger": nextRoot },
          },
          cleared,
          loggedOut: cleared,
        };
      }

      const accounts = { ...(root.accounts ?? {}) };
      const accountEntry = { ...(accounts[nid] ?? {}) } as Record<string, unknown>;
      if (accountEntry.pageAccessToken) {
        delete accountEntry.pageAccessToken;
        accounts[nid] = accountEntry as (typeof accounts)[string];
        cleared = true;
      }
      return {
        cfg: {
          ...nextCfg,
          channels: {
            ...nextCfg.channels,
            "meta-messenger": { ...root, accounts },
          },
        },
        cleared,
        loggedOut: cleared,
      };
    },
  },
};

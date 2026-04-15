import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import {
  DEFAULT_ACCOUNT_ID,
  formatDocsLink,
  setSetupChannelEnabled,
  type ChannelSetupWizard,
} from "openclaw/plugin-sdk/setup";
import { listMetaMessengerAccountIds, resolveMetaMessengerAccount } from "./accounts.js";
import { isMetaMessengerConfigured, metaMessengerSetupAdapter } from "./setup-core.js";
import { patchMetaAccountConfig } from "./setup-core.js";

const channel = "meta-messenger" as const;

const META_SETUP_HELP_LINES = [
  "1) Create a Meta App at https://developers.facebook.com/apps/",
  "2) Add the 'Messenger' and/or 'Instagram' product to the app",
  "3) Generate a Page Access Token and copy it",
  "4) Choose a Webhook Verify Token (any string you invent) and copy it",
  "5) Set META_PAGE_ACCESS_TOKEN and META_WEBHOOK_VERIFY_TOKEN env vars (or configure inline)",
  "6) Point the Meta webhook at https://<gateway-host>/webhook/meta",
  "7) Subscribe to the 'messages' field for Messenger and Instagram",
  `Docs: ${formatDocsLink("/channels/meta-messenger", "channels/meta-messenger")}`,
];

export { metaMessengerSetupAdapter };

export const metaMessengerSetupWizard: ChannelSetupWizard = {
  channel,
  status: {
    configuredLabel: "configured",
    unconfiguredLabel: "needs page token + verify token",
    configuredHint: "configured",
    unconfiguredHint: "needs page token + verify token",
    configuredScore: 1,
    unconfiguredScore: 0,
    resolveConfigured: ({ cfg }) =>
      listMetaMessengerAccountIds(cfg).some((accountId) =>
        isMetaMessengerConfigured(cfg, accountId),
      ),
    resolveStatusLines: ({ cfg, configured }) => [
      `Meta Messenger / Instagram: ${configured ? "configured" : "needs page token + verify token"}`,
      `Accounts: ${listMetaMessengerAccountIds(cfg).length || 0}`,
    ],
  },
  introNote: {
    title: "Meta Messenger / Instagram DMs",
    lines: META_SETUP_HELP_LINES,
    shouldShow: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId?: string }) =>
      !isMetaMessengerConfigured(cfg, accountId ?? DEFAULT_ACCOUNT_ID),
  },
  credentials: [
    {
      inputKey: "token",
      providerHint: channel,
      credentialLabel: "page access token",
      preferredEnvVar: "META_PAGE_ACCESS_TOKEN",
      helpTitle: "Meta Messenger / Instagram",
      helpLines: META_SETUP_HELP_LINES,
      envPrompt: "META_PAGE_ACCESS_TOKEN detected. Use env var?",
      keepPrompt: "Meta page access token already configured. Keep it?",
      inputPrompt: "Enter Meta Page Access Token",
      allowEnv: ({ accountId }) => accountId === DEFAULT_ACCOUNT_ID,
      inspect: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId: string }) => {
        const resolved = resolveMetaMessengerAccount({ cfg, accountId });
        return {
          accountConfigured: Boolean(
            resolved.pageAccessToken.trim() && resolved.webhookVerifyToken.trim(),
          ),
          hasConfiguredValue: Boolean(resolved.config.pageAccessToken?.trim()),
          resolvedValue: resolved.pageAccessToken.trim() || undefined,
          envValue:
            accountId === DEFAULT_ACCOUNT_ID
              ? process.env.META_PAGE_ACCESS_TOKEN?.trim() || undefined
              : undefined,
        };
      },
      applyUseEnv: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId: string }) =>
        patchMetaAccountConfig({
          cfg,
          accountId,
          clearFields: ["pageAccessToken"],
          patch: {},
          enabled: true,
        }),
      applySet: ({
        cfg,
        accountId,
        resolvedValue,
      }: {
        cfg: OpenClawConfig;
        accountId: string;
        resolvedValue: string;
      }) =>
        patchMetaAccountConfig({
          cfg,
          accountId,
          patch: { pageAccessToken: resolvedValue },
          enabled: true,
        }),
    },
    {
      inputKey: "webhookUrl",
      providerHint: "meta-verify-token",
      credentialLabel: "webhook verify token",
      preferredEnvVar: "META_WEBHOOK_VERIFY_TOKEN",
      helpTitle: "Meta Webhook Verify Token",
      helpLines: [
        "The verify token is any string you choose when subscribing the webhook.",
        "It must match exactly what you enter in the Meta App Dashboard.",
        "Example: my-secret-verify-token-2024",
      ],
      envPrompt: "META_WEBHOOK_VERIFY_TOKEN detected. Use env var?",
      keepPrompt: "Meta webhook verify token already configured. Keep it?",
      inputPrompt: "Enter Meta Webhook Verify Token",
      allowEnv: ({ accountId }) => accountId === DEFAULT_ACCOUNT_ID,
      inspect: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId: string }) => {
        const resolved = resolveMetaMessengerAccount({ cfg, accountId });
        return {
          accountConfigured: Boolean(
            resolved.pageAccessToken.trim() && resolved.webhookVerifyToken.trim(),
          ),
          hasConfiguredValue: Boolean(resolved.config.webhookVerifyToken?.trim()),
          resolvedValue: resolved.webhookVerifyToken.trim() || undefined,
          envValue:
            accountId === DEFAULT_ACCOUNT_ID
              ? process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || undefined
              : undefined,
        };
      },
      applyUseEnv: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId: string }) =>
        patchMetaAccountConfig({
          cfg,
          accountId,
          clearFields: ["webhookVerifyToken"],
          patch: {},
          enabled: true,
        }),
      applySet: ({
        cfg,
        accountId,
        resolvedValue,
      }: {
        cfg: OpenClawConfig;
        accountId: string;
        resolvedValue: string;
      }) =>
        patchMetaAccountConfig({
          cfg,
          accountId,
          patch: { webhookVerifyToken: resolvedValue },
          enabled: true,
        }),
    },
  ],
  completionNote: {
    title: "Meta Messenger / Instagram configured",
    lines: [
      "Meta Messenger / Instagram plugin configured.",
      "Start the gateway and point the Meta webhook at: https://<gateway-host>/webhook/meta",
      "Subscribe to the 'messages' field for both Messenger and Instagram.",
    ],
  },
  disable: (cfg: OpenClawConfig) => setSetupChannelEnabled(cfg, channel, false),
};

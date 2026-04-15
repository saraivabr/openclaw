import type { ChannelSetupAdapter, OpenClawConfig } from "openclaw/plugin-sdk/setup";
import { normalizeAccountId, resolveMetaMessengerAccount } from "./accounts.js";
import { DEFAULT_ACCOUNT_ID } from "./shared.js";
import type { MetaMessengerConfig } from "./types.js";

function patchAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  patch: Record<string, unknown>;
  clearFields?: string[];
  enabled?: boolean;
}): OpenClawConfig {
  const accountId = normalizeAccountId(params.accountId);
  const root = (params.cfg.channels?.["meta-messenger"] ?? {}) as MetaMessengerConfig;
  const clearFields = params.clearFields ?? [];

  if (accountId === DEFAULT_ACCOUNT_ID) {
    const next = { ...root } as Record<string, unknown>;
    for (const field of clearFields) {
      delete next[field];
    }
    return {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        "meta-messenger": {
          ...next,
          ...(params.enabled ? { enabled: true } : {}),
          ...params.patch,
        },
      },
    };
  }

  const nextAccount = {
    ...(root.accounts?.[accountId] ?? {}),
  } as Record<string, unknown>;
  for (const field of clearFields) {
    delete nextAccount[field];
  }

  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      "meta-messenger": {
        ...root,
        ...(params.enabled ? { enabled: true } : {}),
        accounts: {
          ...root.accounts,
          [accountId]: {
            ...nextAccount,
            ...(params.enabled ? { enabled: true } : {}),
            ...params.patch,
          },
        },
      },
    },
  };
}

export function isMetaMessengerConfigured(cfg: OpenClawConfig, accountId: string): boolean {
  const resolved = resolveMetaMessengerAccount({ cfg, accountId });
  return Boolean(resolved.pageAccessToken.trim() && resolved.webhookVerifyToken.trim());
}

export const metaMessengerSetupAdapter: ChannelSetupAdapter = {
  resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
  applyAccountName: ({ cfg, accountId, name }) =>
    patchAccountConfig({ cfg, accountId, patch: name ? { name } : {} }),
  applyAccountConfig: ({ cfg, accountId, input }) => {
    const patch: Record<string, unknown> = {};
    if (input.token) {
      patch.pageAccessToken = input.token;
    }
    if (input.webhookUrl) {
      patch.webhookVerifyToken = input.webhookUrl;
    }
    return patchAccountConfig({ cfg, accountId, patch, enabled: true });
  },
  validateInput: ({ input }) => {
    if (!input.token?.trim()) {
      return "Page Access Token is required (input.token)";
    }
    return null;
  },
};

/** Exported alias for use in setup-surface.ts. */
export function patchMetaAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  patch: Record<string, unknown>;
  clearFields?: string[];
  enabled?: boolean;
}): OpenClawConfig {
  return patchAccountConfig(params);
}

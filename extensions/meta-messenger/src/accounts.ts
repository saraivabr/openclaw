import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { DEFAULT_ACCOUNT_ID } from "./shared.js";
import type {
  MetaMessengerAccountConfig,
  MetaMessengerConfig,
  ResolvedMetaMessengerAccount,
  MetaTokenSource,
} from "./types.js";

function normalizeAccountId(accountId: string | undefined): string {
  const trimmed = accountId?.trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

function resolveToken(params: {
  accountId: string;
  baseConfig?: MetaMessengerConfig;
  accountConfig?: MetaMessengerAccountConfig;
}): { token: string; tokenSource: MetaTokenSource } {
  const { accountId, baseConfig, accountConfig } = params;

  if (accountConfig?.pageAccessToken?.trim()) {
    return { token: accountConfig.pageAccessToken.trim(), tokenSource: "config" };
  }

  if (accountId === DEFAULT_ACCOUNT_ID) {
    if (baseConfig?.pageAccessToken?.trim()) {
      return { token: baseConfig.pageAccessToken.trim(), tokenSource: "config" };
    }
    const envToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    if (envToken) {
      return { token: envToken, tokenSource: "env" };
    }
  }

  return { token: "", tokenSource: "none" };
}

function resolveAppSecret(params: {
  accountId: string;
  baseConfig?: MetaMessengerConfig;
  accountConfig?: MetaMessengerAccountConfig;
}): string {
  const { accountId, baseConfig, accountConfig } = params;
  if (accountConfig?.appSecret?.trim()) {
    return accountConfig.appSecret.trim();
  }
  if (accountId === DEFAULT_ACCOUNT_ID) {
    if (baseConfig?.appSecret?.trim()) {
      return baseConfig.appSecret.trim();
    }
    return process.env.META_APP_SECRET?.trim() ?? "";
  }
  return "";
}

function resolveVerifyToken(params: {
  accountId: string;
  baseConfig?: MetaMessengerConfig;
  accountConfig?: MetaMessengerAccountConfig;
}): string {
  const { accountId, baseConfig, accountConfig } = params;
  if (accountConfig?.webhookVerifyToken?.trim()) {
    return accountConfig.webhookVerifyToken.trim();
  }
  if (accountId === DEFAULT_ACCOUNT_ID) {
    if (baseConfig?.webhookVerifyToken?.trim()) {
      return baseConfig.webhookVerifyToken.trim();
    }
    return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
  }
  return "";
}

export function resolveMetaMessengerAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedMetaMessengerAccount {
  const accountId = normalizeAccountId(params.accountId ?? undefined);
  const root = params.cfg.channels?.["meta-messenger"] as MetaMessengerConfig | undefined;
  const accountConfig = accountId !== DEFAULT_ACCOUNT_ID ? root?.accounts?.[accountId] : undefined;

  const { token, tokenSource } = resolveToken({ accountId, baseConfig: root, accountConfig });
  const appSecret = resolveAppSecret({ accountId, baseConfig: root, accountConfig });
  const webhookVerifyToken = resolveVerifyToken({ accountId, baseConfig: root, accountConfig });

  const {
    accounts: _ignoredAccounts,
    defaultAccount: _ignoredDefaultAccount,
    ...rootBase
  } = (root ?? {}) as MetaMessengerConfig & {
    accounts?: unknown;
    defaultAccount?: unknown;
  };

  const mergedConfig: MetaMessengerConfig & MetaMessengerAccountConfig = {
    ...rootBase,
    ...accountConfig,
  };

  const enabled =
    accountConfig?.enabled ?? (accountId === DEFAULT_ACCOUNT_ID ? (root?.enabled ?? true) : false);

  const name = accountConfig?.name ?? (accountId === DEFAULT_ACCOUNT_ID ? root?.name : undefined);

  const pageId =
    accountConfig?.pageId ?? (accountId === DEFAULT_ACCOUNT_ID ? root?.pageId : undefined) ?? "";

  return {
    accountId,
    name,
    enabled,
    pageAccessToken: token,
    tokenSource,
    appSecret,
    webhookVerifyToken,
    pageId,
    config: mergedConfig,
  };
}

export function listMetaMessengerAccountIds(cfg: OpenClawConfig): string[] {
  const root = cfg.channels?.["meta-messenger"] as MetaMessengerConfig | undefined;
  const ids = new Set<string>();

  if (root?.pageAccessToken?.trim() || process.env.META_PAGE_ACCESS_TOKEN?.trim()) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  if (root?.accounts) {
    for (const id of Object.keys(root.accounts)) {
      ids.add(id);
    }
  }

  return Array.from(ids);
}

export function resolveDefaultMetaMessengerAccountId(cfg: OpenClawConfig): string {
  const root = cfg.channels?.["meta-messenger"] as MetaMessengerConfig | undefined;
  const ids = listMetaMessengerAccountIds(cfg);
  const preferred = root?.defaultAccount?.trim();
  if (preferred && ids.includes(preferred)) {
    return preferred;
  }
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export { normalizeAccountId };

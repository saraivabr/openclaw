import { z } from "zod";

const MetaMessengerAccountSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    pageAccessToken: z.string().optional(),
    appSecret: z.string().optional(),
    webhookVerifyToken: z.string().optional(),
    pageId: z.string().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    dmPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
    webhookPort: z.number().optional(),
    webhookPath: z.string().optional(),
  })
  .passthrough();

export const MetaMessengerConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    pageAccessToken: z.string().optional(),
    appSecret: z.string().optional(),
    webhookVerifyToken: z.string().optional(),
    pageId: z.string().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    dmPolicy: z.enum(["open", "allowlist", "pairing", "disabled"]).optional(),
    webhookPort: z.number().optional(),
    webhookPath: z.string().optional(),
    accounts: z.record(z.string(), MetaMessengerAccountSchema).optional(),
    defaultAccount: z.string().optional(),
  })
  .passthrough();

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { META_WEBHOOK_MAX_BODY_BYTES } from "./shared.js";
import type { MetaWebhookPayload } from "./types.js";

/**
 * Read the full request body as a Buffer, up to maxBytes.
 * Returns null if the body exceeds the limit or the connection closes early.
 */
async function readBodyBuffer(req: IncomingMessage, maxBytes: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let settled = false;

    const settle = (result: Buffer | null) => {
      if (settled) return;
      settled = true;
      req.removeAllListeners();
      resolve(result);
    };

    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        settle(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => settle(Buffer.concat(chunks)));
    req.on("error", () => settle(null));
    req.on("close", () => settle(null));
  });
}

/**
 * Verify the Meta webhook signature from the `x-hub-signature-256` header.
 * Returns true when the signature is valid or when appSecret is empty (skip verification).
 */
export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | string[] | undefined,
  appSecret: string,
): boolean {
  if (!appSecret) {
    // App secret not configured: skip signature verification (dev mode only).
    return true;
  }
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof header !== "string") {
    return false;
  }
  const prefix = "sha256=";
  if (!header.startsWith(prefix)) {
    return false;
  }
  const expected = header.slice(prefix.length);
  const computed = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const computedBuf = Buffer.from(computed, "hex");
  if (expectedBuf.length !== computedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, computedBuf);
}

export type MetaWebhookHandlerOptions = {
  /** Callback invoked for every verified webhook payload. */
  onPayload: (payload: MetaWebhookPayload) => void | Promise<void>;
  /** Token used for GET-based webhook verification with Meta. */
  verifyToken: string;
  /** App secret for validating the x-hub-signature-256 header (recommended). */
  appSecret?: string;
  /** HTTP path to listen on. Defaults to /webhook/meta. */
  path?: string;
  /** Health check path. Defaults to /healthz. */
  healthPath?: string;
  /** Port to listen on. Defaults to 8789. */
  port?: number;
  /** Host to bind on. Defaults to 127.0.0.1. */
  host?: string;
  /** Optional logger function. */
  log?: (msg: string) => void;
};

export type MetaWebhookServer = {
  server: ReturnType<typeof createServer>;
  stop: () => void;
};

/**
 * Start an HTTP server that receives Meta Graph API webhook events.
 * Handles:
 *  - GET  /webhook/meta  → webhook verification (hub.challenge)
 *  - POST /webhook/meta  → inbound messages
 */
export async function startMetaWebhookServer(
  opts: MetaWebhookHandlerOptions,
): Promise<MetaWebhookServer> {
  const path = opts.path ?? "/webhook/meta";
  const healthPath = opts.healthPath ?? "/healthz";
  const port = opts.port ?? 8789;
  const host = opts.host ?? "127.0.0.1";
  const appSecret = opts.appSecret ?? "";
  const log = opts.log ?? (() => undefined);

  const respond = (res: ServerResponse, status: number, body = "") => {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(body);
  };

  const server = createServer((req, res) => {
    // Health check
    if (req.url === healthPath) {
      respond(res, 200, "ok");
      return;
    }

    // Only handle our webhook path
    const urlBase = req.url?.split("?")[0];
    if (urlBase !== path) {
      respond(res, 404);
      return;
    }

    // GET → webhook verification
    if (req.method === "GET") {
      const query = new URLSearchParams(req.url?.split("?")[1] ?? "");
      const mode = query.get("hub.mode");
      const token = query.get("hub.verify_token");
      const challenge = query.get("hub.challenge");

      if (mode === "subscribe" && token === opts.verifyToken && challenge) {
        log("Meta webhook verification succeeded");
        respond(res, 200, challenge);
      } else {
        log("Meta webhook verification failed: token mismatch");
        respond(res, 403, "Forbidden");
      }
      return;
    }

    // POST → inbound event
    if (req.method !== "POST") {
      respond(res, 405);
      return;
    }

    void (async () => {
      const rawBody = await readBodyBuffer(req, META_WEBHOOK_MAX_BODY_BYTES);
      if (!rawBody) {
        respond(res, 413, "Payload too large");
        return;
      }

      if (!verifyMetaSignature(rawBody, req.headers["x-hub-signature-256"], appSecret)) {
        log("Meta webhook signature validation failed");
        respond(res, 401, "Invalid signature");
        return;
      }

      let payload: MetaWebhookPayload;
      try {
        payload = JSON.parse(rawBody.toString("utf-8")) as MetaWebhookPayload;
      } catch {
        respond(res, 400, "Invalid JSON");
        return;
      }

      // Acknowledge quickly; process asynchronously.
      respond(res, 200, "EVENT_RECEIVED");

      try {
        await opts.onPayload(payload);
      } catch (err) {
        log(`Meta webhook handler error: ${String(err)}`);
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    const onErr = (err: Error) => {
      server.off("error", onErr);
      reject(err);
    };
    server.once("error", onErr);
    server.listen(port, host, () => {
      server.off("error", onErr);
      resolve();
    });
  });

  const address = server.address();
  const boundPort = address && typeof address !== "string" ? address.port : port;
  log(`Meta webhook listening on http://${host}:${boundPort}${path}`);

  const stop = () => {
    server.close();
  };

  return { server, stop };
}

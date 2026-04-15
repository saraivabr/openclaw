import { META_GRAPH_API_BASE } from "./shared.js";

export type MetaSendTextResult = {
  messageId: string;
  recipientId: string;
};

/**
 * Send a text message to a Messenger / Instagram user via the Meta Send API.
 *
 * @param recipientId - The PSID (Messenger) or IGSID (Instagram) of the recipient.
 * @param text        - The message text to send.
 * @param pageToken   - Page Access Token.
 * @param fetchFn     - Optional fetch override (for testing).
 */
export async function sendMetaTextMessage(
  recipientId: string,
  text: string,
  pageToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<MetaSendTextResult> {
  const url = `${META_GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  });

  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const json = (await response.json()) as { error?: { message?: string } };
      detail = json.error?.message ?? "";
    } catch {
      // ignore parse errors
    }
    throw new Error(`Meta Send API error ${response.status}: ${detail || response.statusText}`);
  }

  const result = (await response.json()) as {
    message_id?: string;
    recipient_id?: string;
  };

  return {
    messageId: result.message_id ?? "",
    recipientId: result.recipient_id ?? recipientId,
  };
}

/**
 * Send a "sender action" typing indicator to a Meta user.
 * action: "typing_on" | "typing_off" | "mark_seen"
 */
export async function sendMetaSenderAction(
  recipientId: string,
  action: "typing_on" | "typing_off" | "mark_seen",
  pageToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const url = `${META_GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const body = JSON.stringify({
    recipient: { id: recipientId },
    sender_action: action,
  });
  await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

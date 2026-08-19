/**
 * Chat service.
 *
 * Responsibility: create conversations and communicate with the Express API
 * for normal and SSE-based Agent responses. UI state, loading indicators and
 * notifications belong to the page or composable, not this module.
 */
const API_BASE_URL = "/api";

/**
 * Send a JSON request to the business API and normalize failed responses.
 * @param {string} path API path relative to /api.
 * @param {RequestInit} options fetch options.
 * @returns {Promise<any>} Parsed API response.
 */
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "服务暂时不可用，请稍后重试");
  return payload;
}

/**
 * Send a message and wait for the complete non-streaming response.
 * Prefer streamMessage for the chat UI so the answer can be rendered sooner.
 * @param {string} content User message.
 * @returns {Promise<object>} Agent response with message and execution steps.
 */
export async function sendMessage(content) {
  const conversation = await request("/conversations", { method: "POST", body: JSON.stringify({ title: content.slice(0, 20) }) });
  return request(`/conversations/${conversation.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
}

/** List the current user's conversations, newest first. */
export function listConversations() { return request("/conversations"); }

export function listModels() { return request("/models"); }

/** Create a server-generated conversation for the current user. */
export function createConversation(title = "新对话") { return request("/conversations", { method: "POST", body: JSON.stringify({ title }) }); }

/** Load one conversation including its persisted messages. */
export function getConversation(id) { return request(`/conversations/${encodeURIComponent(id)}`); }

/** Delete one conversation owned by the current user. */
export async function deleteConversation(id) {
  const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "删除会话失败"); }
}

/**
 * Send a message through Server-Sent Events.
 * The callback receives connected, status, token, final and message events.
 * Uses a POST response stream so the request is sent as JSON.
 * History context is managed server-side by LangGraph checkpointer.
 * @param {string} conversationId Target conversation ID (used as checkpointer thread_id).
 * @param {string} content User message.
 * @param {(event: string, payload: object) => void} onEvent SSE event callback.
 * @param {string} modelId Optional model override ID.
 * @param {string} thinkingMode Thinking mode: "auto" | "enabled" | "disabled".
 * @returns {Promise<void>}
 */
export async function streamMessage(conversationId, content, onEvent, modelId = "", thinkingMode = "disabled") {
  const response = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, modelId, thinkingMode })
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "流式请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  while (!finished) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const eventLine = block.split("\n").find((line) => line.startsWith("event: "));
      const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const eventName = eventLine.slice(7);
      const payload = JSON.parse(dataLine.slice(6));
      if (eventName === "done") finished = true;
      if (eventName === "error") throw new Error(payload.error || "流式请求失败");
      onEvent(eventName, payload);
    }

    if (done) finished = true;
  }
}

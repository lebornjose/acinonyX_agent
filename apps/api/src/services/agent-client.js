import { env } from "../config/env.js";
export async function runAgent(task, conversationId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AGENT_TIMEOUT_MS || 90000));
  try {
    const response = await fetch(`${env.agentServiceUrl}/internal/agent/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, conversationId }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Agent 服务调用失败");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Agent 响应超时，请稍后重试");
    throw error;
  } finally { clearTimeout(timer); }
}

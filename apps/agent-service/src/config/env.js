import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const agentServiceDirectory = path.resolve(configDirectory, "../..");
const repositoryRoot = path.resolve(configDirectory, "../../../..");

dotenv.config({
  path: path.join(repositoryRoot, ".env")
});
dotenv.config({
  path: path.join(agentServiceDirectory, ".env"),
  override: true
});

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function decimal(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAgentConfig(env = process.env) {
  const modelApiKey = env.LLM_API_KEY || "";
  const modelName = env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = env.LLM_BASE_URL || "";

  return {
    port: positiveInteger(env.AGENT_PORT, 4002),
    provider: env.LLM_PROVIDER || "openai-compatible",
    model: modelName,
    apiKey: modelApiKey,
    baseUrl,
    organization: env.LLM_ORGANIZATION || "",
    temperature: decimal(env.LLM_TEMPERATURE, 0.2),
    timeoutMs: positiveInteger(
      env.LLM_TIMEOUT_MS,
      60000
    ),
    tencentTimeoutMs: positiveInteger(env.TENCENT_QUOTE_TIMEOUT_MS, 6000),
    maxRetries: Number.isInteger(
      Number(env.LLM_MAX_RETRIES)
    )
      ? Number(env.LLM_MAX_RETRIES)
      : 1
  };
}

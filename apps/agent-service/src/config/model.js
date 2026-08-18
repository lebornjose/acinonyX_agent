import { ChatOpenAI } from "@langchain/openai";
export function createModel(config) {
  if (!config.apiKey) {
    throw new Error("AGENT_CONFIG_ERROR: 缺少 LLM_API_KEY。");
  }

  const temperature = config.provider === "kimi" ? 1 : config.temperature;
  const topP = config.provider === "kimi" ? 0.95 : undefined;
  const modelKwargs = {};

  if (config.thinkingMode !== "auto") {
    const thinkingEnabled = config.thinkingMode === "enabled";

    if (config.provider === "deepseek" || config.provider === "doubao") {
      modelKwargs.thinking = {
        type: thinkingEnabled ? "enabled" : "disabled"
      };
    }

    if (config.provider === "qwen") {
      modelKwargs.enable_thinking = thinkingEnabled;
    }
  }

  const configuration = {};
  if (config.baseUrl) configuration.baseURL = config.baseUrl;
  if (config.organization) configuration.organization = config.organization;
  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    temperature,
    ...(topP === undefined ? {} : { topP }),
    ...(Object.keys(modelKwargs).length === 0 ? {} : { modelKwargs }),
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
    configuration
  });
}

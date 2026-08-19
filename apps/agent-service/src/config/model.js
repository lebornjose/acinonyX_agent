/**
 * @file model.js
 * @description 根据运行时配置创建 LangChain ChatOpenAI 实例。
 *
 * 支持的供应商（通过 config.provider 区分）：
 *   - openai-compatible（默认）：标准 OpenAI 兼容接口
 *   - kimi：月之暗面，temperature 强制为 1，topP 固定 0.95
 *   - deepseek：DeepSeek，支持 thinking（深度思考）模式开关
 *   - doubao：字节跳动豆包，与 deepseek 使用相同的 thinking 字段格式
 *   - qwen：通义千问，使用 enable_thinking 字段开关深度思考
 *
 * 深度思考模式（thinkingMode）：
 *   - "auto"     （默认）：不传 thinking 参数，由供应商自行决定
 *   - "enabled"  ：强制开启深度思考
 *   - "disabled" ：强制关闭深度思考
 */

import { ChatOpenAI } from "@langchain/openai";

/**
 * 根据配置创建并返回 ChatOpenAI 模型实例。
 *
 * @param {object} config              - 来自 loadAgentConfig() 的配置对象
 * @param {string} config.apiKey       - LLM API 密钥（必填，缺失时抛出错误）
 * @param {string} config.provider     - 供应商标识（kimi / deepseek / doubao / qwen / openai-compatible）
 * @param {string} config.model        - 模型名称
 * @param {number} config.temperature  - 生成温度（kimi 供应商会被覆盖为 1）
 * @param {string} [config.baseUrl]    - 自定义 API Base URL
 * @param {string} [config.organization] - OpenAI 组织 ID
 * @param {number} config.timeoutMs    - 单次请求超时（毫秒）
 * @param {number} config.maxRetries   - 请求失败重试次数
 * @param {string} [config.thinkingMode] - 深度思考模式："auto" | "enabled" | "disabled"
 * @returns {ChatOpenAI} LangChain 模型实例
 * @throws {Error} 当 apiKey 为空时抛出，携带可读的错误标识
 */
export function createModel(config) {
  // API 密钥是必填项；缺失时立即抛出，避免后续产生难以排查的网络错误
  if (!config.apiKey) {
    throw new Error("AGENT_CONFIG_ERROR: 缺少 LLM_API_KEY。");
  }

  // kimi 供应商要求 temperature=1、topP=0.95，其他供应商使用配置值
  const temperature = config.provider === "kimi" ? 1 : config.temperature;
  const topP = config.provider === "kimi" ? 0.95 : undefined;

  // modelKwargs 用于向 LangChain 透传供应商特有的请求体字段
  const modelKwargs = {};

  // 仅在明确指定 enabled/disabled 时才设置 thinking 参数；
  // "auto" 模式下不传该字段，由供应商默认行为决定
  if (config.thinkingMode !== "auto") {
    const thinkingEnabled = config.thinkingMode === "enabled";

    // deepseek 和 doubao 使用 thinking.type 字段控制深度思考
    if (config.provider === "deepseek" || config.provider === "doubao") {
      modelKwargs.thinking = {
        type: thinkingEnabled ? "enabled" : "disabled"
      };
    }

    // qwen（通义千问）使用 enable_thinking 布尔字段
    if (config.provider === "qwen") {
      modelKwargs.enable_thinking = thinkingEnabled;
    }
  }

  // configuration 用于传递 LangChain ChatOpenAI 的底层 HTTP 客户端选项
  const configuration = {};
  if (config.baseUrl) {
    configuration.baseURL = config.baseUrl;
  }
  if (config.organization) {
    configuration.organization = config.organization;
  }

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    temperature,
    // topP 仅 kimi 供应商时传入，其他情况不传（避免影响默认行为）
    ...(topP === undefined ? {} : { topP }),
    // modelKwargs 为空对象时不传，避免干扰不支持该字段的供应商
    ...(Object.keys(modelKwargs).length === 0 ? {} : { modelKwargs }),
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
    configuration
  });
}

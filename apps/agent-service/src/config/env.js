/**
 * @file env.js
 * @description 环境变量加载与 Agent 配置解析。
 *
 * 加载顺序：
 *   1. 仓库根目录 .env（基础默认值）
 *   2. apps/agent-service/.env（服务级覆盖，优先级更高）
 *
 * 最终配置由 loadAgentConfig() 导出，供 server.js 和 create-runtime.js 使用。
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 当前文件所在目录（apps/agent-service/src/config）
const configDirectory = path.dirname(fileURLToPath(import.meta.url));

// agent-service 根目录（apps/agent-service）
const agentServiceDirectory = path.resolve(configDirectory, "../..");

// monorepo 根目录（仓库根）
const repositoryRoot = path.resolve(configDirectory, "../../../..");

// 先加载仓库根目录的 .env，作为全局基础配置
dotenv.config({
  path: path.join(repositoryRoot, ".env")
});

// 再加载 agent-service 自身的 .env，同名变量会覆盖全局值
dotenv.config({
  path: path.join(agentServiceDirectory, ".env"),
  override: true
});

/**
 * 将字符串解析为正整数。
 * 若解析失败或结果不是正整数，返回 fallback 默认值。
 *
 * @param {string|undefined} value    - 待解析的字符串（通常来自 process.env）
 * @param {number}           fallback - 解析失败时使用的默认值
 * @returns {number}
 */
function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 将字符串解析为有限浮点数。
 * 若解析失败（NaN、Infinity），返回 fallback 默认值。
 *
 * @param {string|undefined} value    - 待解析的字符串（通常来自 process.env）
 * @param {number}           fallback - 解析失败时使用的默认值
 * @returns {number}
 */
function decimal(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 从环境变量中读取并解析 Agent 服务所需的全部配置项。
 *
 * 支持的环境变量：
 *   AGENT_PORT               - HTTP 监听端口，默认 4002
 *   LLM_PROVIDER             - 模型供应商标识（openai-compatible / deepseek / kimi / qwen / doubao），默认 openai-compatible
 *   LLM_MODEL                - 模型名称，默认 gpt-4o-mini
 *   LLM_API_KEY              - 模型 API 密钥（必填）
 *   LLM_BASE_URL             - 自定义 API 基础 URL（OpenAI 兼容接口时使用）
 *   LLM_ORGANIZATION         - OpenAI 组织 ID（可选）
 *   LLM_TEMPERATURE          - 生成温度，默认 0.2
 *   LLM_TIMEOUT_MS           - 单次请求超时（毫秒），默认 60000
 *   LLM_MAX_RETRIES          - 失败重试次数，默认 1
 *   HITHINK_FINANCE_API_KEY   - 同花顺金融数据 API Key（可选）
 *   HITHINK_FINANCE_BASE_URL  - 同花顺金融数据 API 地址
 *   HITHINK_FINANCE_TIMEOUT_MS - 同花顺金融数据请求超时（毫秒），默认 10000
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 注入的环境变量对象（便于测试）
 * @returns {AgentConfig} 解析后的配置对象
 */
export function loadAgentConfig(env = process.env) {
  const modelApiKey = env.LLM_API_KEY || "";
  const modelName = env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = env.LLM_BASE_URL || "";

  return {
    // HTTP 服务监听端口
    port: positiveInteger(env.AGENT_PORT, 4002),

    // 模型供应商，用于在 model.js 中选择特定参数（如 kimi 的 topP）
    provider: env.LLM_PROVIDER || "openai-compatible",

    // 模型名称，透传给 LangChain ChatOpenAI
    model: modelName,

    // API 密钥；缺失时 createModel() 会抛出可读错误
    apiKey: modelApiKey,

    // 自定义 Base URL，留空则使用 LangChain 默认的 OpenAI 地址
    baseUrl,

    // OpenAI 组织 ID（多组织账号时使用）
    organization: env.LLM_ORGANIZATION || "",

    // 生成温度（0-2）；kimi 供应商在 model.js 中会强制覆盖为 1
    temperature: decimal(env.LLM_TEMPERATURE, 0.2),

    // 单次 LLM 请求的最大等待时间（毫秒）
    timeoutMs: positiveInteger(env.LLM_TIMEOUT_MS, 60000),

    // LLM 请求失败时的自动重试次数
    maxRetries: Number.isInteger(Number(env.LLM_MAX_RETRIES))
      ? Number(env.LLM_MAX_RETRIES)
      : 1,

    // 同花顺金融数据配置；Key 缺失时由对应工具返回可读的配置错误。
    hithinkFinanceApiKey: env.HITHINK_FINANCE_API_KEY || "",
    hithinkFinanceBaseUrl: env.HITHINK_FINANCE_BASE_URL || "https://fuyao.aicubes.cn",
    hithinkFinanceTimeoutMs: positiveInteger(env.HITHINK_FINANCE_TIMEOUT_MS, 10000)
  };
}

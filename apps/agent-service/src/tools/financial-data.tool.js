/**
 * @file financial-data.tool.js
 * @description 腾讯财经估值指标工具。
 *
 * 通过 qt.gtimg.cn 实时行情接口免费获取 A 股 PE、PE-TTM、PB 和市值数据。
 * 无需 Token，适合开发环境和中小规模生产部署。
 *
 * 接口响应格式示例：
 *   v_sh600036="...字段0~字段1~...~字段N...";
 * 字段之间以波浪线（~）分隔，通过固定索引提取所需指标。
 *
 * 本工具只返回接口直接提供的字段，不推断或补全任何缺失数据。
 */

import { z } from "zod";

/**
 * 腾讯财经 qt.gtimg.cn 实时行情接口字段索引（以 ~ 分隔）。
 * 字段经实测验证，适用于 A 股沪深主板、创业板和科创板。
 *
 * index 39  动态市盈率（PE，年化）
 * index 52  PE-TTM（滚动12个月市盈率）
 * index 53  市净率（PB）
 * index 44  总市值（亿元）
 * index 45  流通市值（亿元）
 */
const FIELD_PE = 39;
const FIELD_PE_TTM = 52;
const FIELD_PB = 53;
const FIELD_TOTAL_MV = 44;
const FIELD_CIRC_MV = 45;

/**
 * 将内部股票代码（SH600036 / SZ000001 / BJ430047）
 * 转为腾讯行情接口格式（sh600036 / sz000001 / bj430047）。
 *
 * @param {string} code - 大写前缀格式的股票代码
 * @returns {string} 小写格式的腾讯接口代码
 */
function toTencentCode(code) {
  return String(code || "").toLowerCase();
}

/**
 * 请求参数校验 schema。
 * code 必须是 SH/SZ/BJ 前缀 + 6 位数字的格式。
 */
const REQUEST_SCHEMA = z.object({
  code: z.string().regex(/^(?:SH|SZ|BJ)\d{6}$/u)
});

/**
 * 将字符串值转换为有效的有限数字。
 * 若值为 0、NaN 或 Infinity，则视为数据缺失，返回 null。
 *
 * @param {string|number} value - 待转换的原始值
 * @returns {number|null} 有效的有限非零数字，或 null（表示数据不可用）
 */
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/**
 * 构造"数据不可用"的统一响应结构。
 * 所有错误分支都通过此函数返回，保证响应格式一致。
 *
 * @param {string} reason - 人类可读的不可用原因说明
 * @returns {object} 不可用状态的响应对象
 */
function buildUnavailable(reason) {
  return {
    status: "unavailable",
    reason,
    current: null,
    sixMonthPeTtmRange: null
  };
}

/**
 * 创建腾讯财经估值指标工具实例。
 *
 * 工具通过 qt.gtimg.cn 实时行情接口获取 PE、PE-TTM、PB 和市值，
 * 完全免费、无需 Token，适合开发和中小规模部署。
 *
 * 输入约束：code 必须是 SH/SZ/BJ 前缀加 6 位数字。
 * 输出约束：只返回程序从接口直接解析的字段；不推断或补全缺失数据。
 * 超时：默认 6 秒，可通过 config.tencentTimeoutMs 调整。
 *
 * @param {object} config                    - Agent 配置对象
 * @param {number} [config.tencentTimeoutMs] - 腾讯接口请求超时（毫秒），默认 6000
 * @returns {{ name: string, invoke: Function }} 工具对象
 */
export function createFinancialDataTool(config) {
  // 从配置读取超时时间；未配置时默认 6 秒
  const timeoutMs = config.tencentTimeoutMs || 6000;

  return {
    name: "financial_data",

    /**
     * 获取指定 A 股的实时估值指标。
     *
     * @param {object} params      - 调用参数
     * @param {string} params.code - 股票代码，格式：SH600036 / SZ000001 / BJ430047
     * @returns {Promise<object>}  成功时返回 status:"available" 及各估值字段；
     *                             失败时返回 status:"unavailable" 及 reason 说明
     */
    async invoke({ code }) {
      // 校验入参格式，格式不合法时直接返回不可用，不发起网络请求
      const parsed = REQUEST_SCHEMA.safeParse({ code });
      if (!parsed.success) {
        return buildUnavailable("股票代码格式无效，无法查询估值指标。");
      }

      // 将 SH600036 转换为腾讯接口所需的 sh600036 格式
      const tencentCode = toTencentCode(parsed.data.code);
      const url = `https://qt.gtimg.cn/q=${tencentCode}`;

      // 使用 AbortController 实现请求超时控制
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: {
            // 模拟浏览器 User-Agent，避免被接口拒绝
            "User-Agent": "Mozilla/5.0",
            // Referer 是腾讯行情接口的必要请求头，缺少时会返回空数据
            "Referer": "https://gu.qq.com/"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          return buildUnavailable("腾讯财经行情接口暂时不可用。");
        }

        const text = await response.text();

        // 响应格式：v_sh600036="...字段用~分隔...";
        // 用正则提取双引号内的数据部分
        const match = text.match(/"([^"]+)"/);
        if (!match) {
          return buildUnavailable("腾讯财经接口返回格式异常。");
        }

        // 按波浪线切割成字段数组
        const parts = match[1].split("~");

        // 最大字段索引为 53（PB），需要至少 55 个字段才能安全读取
        if (parts.length < 55) {
          return buildUnavailable("腾讯财经接口返回数据字段不足，无法提取估值指标。");
        }

        // PE-TTM 是核心字段；若为空则说明股票已停牌或退市，无法提供有效估值
        const peTtm = numberOrNull(parts[FIELD_PE_TTM]);

        if (peTtm === null) {
          return buildUnavailable("当前股票暂无 PE-TTM 数据（可能已停牌或退市）。");
        }

        return {
          status: "available",
          source: "tencent",
          // dataAsOf 由 stock_analysis 工具从 K 线数据中填充；此处返回 null
          dataAsOf: null,
          current: {
            pe: numberOrNull(parts[FIELD_PE]),            // 动态市盈率（年化）
            peTtm,                                         // PE-TTM（滚动12个月）
            pb: numberOrNull(parts[FIELD_PB]),             // 市净率
            totalMarketValue: numberOrNull(parts[FIELD_TOTAL_MV]),       // 总市值（亿元）
            circulatingMarketValue: numberOrNull(parts[FIELD_CIRC_MV])  // 流通市值（亿元）
          },
          // 六个月 PE-TTM 区间需要历史数据，当前接口不提供，预留为 null
          sixMonthPeTtmRange: null
        };
      } catch (error) {
        // AbortController 超时触发时，fetch 会抛出 AbortError
        if (error.name === "AbortError") {
          return buildUnavailable("腾讯财经估值数据请求超时，请稍后重试。");
        }

        // 其他网络或解析错误
        return buildUnavailable("腾讯财经估值数据请求失败，请稍后重试。");
      } finally {
        // 无论成功还是失败，都必须清除定时器，避免内存泄漏
        clearTimeout(timeout);
      }
    }
  };
}

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
 */
function toTencentCode(code) {
  return String(code || "").toLowerCase();
}

const REQUEST_SCHEMA = z.object({
  code: z.string().regex(/^(?:SH|SZ|BJ)\d{6}$/u)
});

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function buildUnavailable(reason) {
  return {
    status: "unavailable",
    reason,
    current: null,
    sixMonthPeTtmRange: null
  };
}

/**
 * 创建腾讯财经估值指标工具。
 *
 * 工具通过 qt.gtimg.cn 实时行情接口获取 PE、PE-TTM、PB 和市值，
 * 完全免费、无需 Token，适合开发和中小规模部署。
 *
 * 输入约束：code 必须是 SH/SZ/BJ 前缀加 6 位数字。
 * 输出约束：只返回程序从接口直接解析的字段；不推断或补全缺失数据。
 * 超时：默认 6 秒，可通过 config.tencentTimeoutMs 调整。
 */
export function createFinancialDataTool(config) {
  const timeoutMs = config.tencentTimeoutMs || 6000;

  return {
    name: "financial_data",

    async invoke({ code }) {
      const parsed = REQUEST_SCHEMA.safeParse({ code });
      if (!parsed.success) {
        return buildUnavailable("股票代码格式无效，无法查询估值指标。");
      }

      const tencentCode = toTencentCode(parsed.data.code);
      const url = `https://qt.gtimg.cn/q=${tencentCode}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://gu.qq.com/"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          return buildUnavailable("腾讯财经行情接口暂时不可用。");
        }

        const text = await response.text();

        // 响应格式：v_sh600036="...字段用~分隔...";
        const match = text.match(/"([^"]+)"/);
        if (!match) {
          return buildUnavailable("腾讯财经接口返回格式异常。");
        }

        const parts = match[1].split("~");
        if (parts.length < 55) {
          return buildUnavailable("腾讯财经接口返回数据字段不足，无法提取估值指标。");
        }

        const peTtm = numberOrNull(parts[FIELD_PE_TTM]);

        if (peTtm === null) {
          return buildUnavailable("当前股票暂无 PE-TTM 数据（可能已停牌或退市）。");
        }

        return {
          status: "available",
          source: "tencent",
          dataAsOf: null,
          current: {
            pe: numberOrNull(parts[FIELD_PE]),
            peTtm,
            pb: numberOrNull(parts[FIELD_PB]),
            totalMarketValue: numberOrNull(parts[FIELD_TOTAL_MV]),
            circulatingMarketValue: numberOrNull(parts[FIELD_CIRC_MV])
          },
          sixMonthPeTtmRange: null
        };
      } catch (error) {
        if (error.name === "AbortError") {
          return buildUnavailable("腾讯财经估值数据请求超时，请稍后重试。");
        }

        return buildUnavailable("腾讯财经估值数据请求失败，请稍后重试。");
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

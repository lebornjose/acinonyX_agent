/**
 * @file hithink-finance.client.js
 * @description 同花顺金融数据 REST API 客户端。
 */

const DEFAULT_BASE_URL = "https://fuyao.aicubes.cn";

export class HithinkFinanceError extends Error {
  constructor(message, code = "HITHINK_FINANCE_ERROR") {
    super(message);
    this.name = "HithinkFinanceError";
    this.code = code;
  }
}

function createRequestUrl(baseUrl, pathname, params) {
  const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/u, "");
  const url = new URL(`${normalizedBaseUrl}${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function responseError(payload) {
  if (payload.code === 2001 || payload.code === 2003) {
    return new HithinkFinanceError("同花顺金融数据 API Key 无效或没有该数据能力权限。", "HITHINK_AUTH_ERROR");
  }

  return new HithinkFinanceError("同花顺金融数据服务暂时无法返回有效结果。", "HITHINK_PROVIDER_ERROR");
}

function buildAmbiguityError(candidates) {
  const choices = candidates
    .slice(0, 5)
    .map((item) => `${item.name}（${item.thscode}）`)
    .join("、");

  return new HithinkFinanceError(`找到多个可能的 A 股标的：${choices}。请提供 6 位股票代码。`, "HITHINK_SYMBOL_AMBIGUOUS");
}

export function createHithinkFinanceClient(config) {
  const apiKey = String(config.hithinkFinanceApiKey || "").trim();
  const baseUrl = config.hithinkFinanceBaseUrl || DEFAULT_BASE_URL;
  const timeoutMs = config.hithinkFinanceTimeoutMs || 10000;

  async function request(pathname, params = {}) {
    if (!apiKey) {
      throw new HithinkFinanceError("未配置 HITHINK_FINANCE_API_KEY，无法查询同花顺金融数据。", "HITHINK_CONFIG_ERROR");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(createRequestUrl(baseUrl, pathname, params), {
        headers: {
          "X-api-key": apiKey
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new HithinkFinanceError("同花顺金融数据服务请求失败。", "HITHINK_PROVIDER_ERROR");
      }

      const payload = await response.json();
      if (!payload || payload.code !== 0) {
        throw responseError(payload || {});
      }

      return payload.data || {};
    } catch (error) {
      if (error instanceof HithinkFinanceError) {
        throw error;
      }

      if (error.name === "AbortError") {
        throw new HithinkFinanceError("同花顺金融数据请求超时，请稍后重试。", "HITHINK_TIMEOUT_ERROR");
      }

      throw new HithinkFinanceError("同花顺金融数据服务请求失败。", "HITHINK_PROVIDER_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function resolveAshare(query) {
    const data = await request("/api/meta/tickers/search", {
      q: query,
      asset_type: "a-share",
      limit: 10
    });
    const candidates = Array.isArray(data.item) ? data.item : [];
    const exactMatch = candidates.find((item) => item.name === query || item.thscode === query);

    if (exactMatch) {
      return exactMatch;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    if (!candidates.length) {
      throw new HithinkFinanceError("未能识别 A 股代码，请提供股票名称或 6 位股票代码。", "HITHINK_SYMBOL_NOT_FOUND");
    }

    throw buildAmbiguityError(candidates);
  }

  return {
    resolveAshare,
    async getSnapshot(thscode) {
      const data = await request("/api/a-share/prices/snapshot", { thscodes: thscode });
      return Array.isArray(data.item) ? data.item[0] || null : null;
    },
    async getHistoricalPrices(thscode, start, end) {
      const data = await request("/api/a-share/prices/historical", {
        thscode,
        interval: "1d",
        start,
        end,
        adjust: "forward"
      });
      return Array.isArray(data.item) ? data.item : [];
    },
    async getValuation(thscode) {
      const data = await request("/api/a-share/valuations/snapshot", { thscodes: thscode });
      return {
        item: Array.isArray(data.item) ? data.item[0] || null : null,
        timestamp: data.timestamp || null
      };
    }
  };
}

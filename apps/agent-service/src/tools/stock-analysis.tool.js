import { stocks } from "stock-api";
import { z } from "zod";

const STOCK_CODE_PATTERN = /\b(?:(?:SH|SZ)\d{6}|(?:60|68|00|30|83|87|92)\d{4})\b/i;
const STOCK_REQUEST_PATTERN = /当前价格|股价|行情|走势|市盈率|PE|估值|涨跌|波动|分析.*股票|看看.*股票|分析一下/u;
const MAX_TASK_LENGTH = 2000;
const STOCK_TASK_SCHEMA = z.object({
  task: z.string().trim().min(1).max(MAX_TASK_LENGTH)
});

export class StockToolError extends Error {
  constructor(message, code = "STOCK_DATA_ERROR") {
    super(message);
    this.name = "StockToolError";
    this.code = code;
  }
}

/**
 * 判断问题是否需要调用行情数据。
 * 只有包含股票代码，或同时包含股票分析意图和较具体的对象描述时才触发，
 * 避免“什么是市盈率”这类概念问题被误判为实时行情请求。
 */
export function isStockAnalysisTask(task) {
  const text = String(task || "").trim();
  if (STOCK_CODE_PATTERN.test(text)) {
    return true;
  }

  const hasStockIntent = STOCK_REQUEST_PATTERN.test(text);
  const hasSpecificObject = /[\u4e00-\u9fff]{2,12}/u.test(text) && !/^什么是|^如何理解/u.test(text);
  return hasStockIntent && hasSpecificObject;
}

function normalizeStockCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (/^(SH|SZ)\d{6}$/u.test(normalized)) {
    return normalized;
  }

  if (/^(60|68)\d{4}$/u.test(normalized)) {
    return `SH${normalized}`;
  }

  if (/^(00|30)\d{4}$/u.test(normalized)) {
    return `SZ${normalized}`;
  }

  if (/^(83|87|92)\d{4}$/u.test(normalized)) {
    return `BJ${normalized}`;
  }

  return "";
}

function extractStockCode(task) {
  const prefixedCode = String(task || "").match(/\b(?:SH|SZ)\d{6}\b/i)?.[0];
  if (prefixedCode) {
    return normalizeStockCode(prefixedCode);
  }

  const plainCode = String(task || "").match(/\b(?:60|68|00|30|83|87|92)\d{4}\b/u)?.[0];
  return normalizeStockCode(plainCode);
}

function searchKeyword(task) {
  return String(task || "")
    .replace(/当前价格|股价|行情|走势|市盈率|PE|估值|涨跌|波动|分析|一下|看看|最近|近[一三六个0-9]+个月|帮我|请|的|？|\?/giu, " ")
    .trim()
    .split(/\s+/u)[0];
}

function finiteNumbers(values) {
  return values.filter((value) => Number.isFinite(value));
}

function percentage(value) {
  return Number.isFinite(value) ? value * 100 : null;
}

function calculateWindowMetrics(klines, count) {
  const window = klines.slice(-count);
  const closes = finiteNumbers(window.map((item) => Number(item.close)));
  if (!closes.length) {
    return null;
  }

  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const highest = Math.max(...closes);
  const lowest = Math.min(...closes);
  const returns = closes.slice(1).map((close, index) => (close / closes[index]) - 1);
  const averageReturn = returns.length
    ? returns.reduce((total, value) => total + value, 0) / returns.length
    : 0;
  const variance = returns.length
    ? returns.reduce((total, value) => total + ((value - averageReturn) ** 2), 0) / returns.length
    : 0;

  return {
    startDate: window[0]?.date || null,
    endDate: window.at(-1)?.date || null,
    firstClose,
    lastClose,
    highest,
    lowest,
    changeRate: percentage((lastClose / firstClose) - 1),
    volatility: percentage(Math.sqrt(variance) * Math.sqrt(Math.max(returns.length, 1))),
    rangePosition: highest === lowest ? 0.5 : (lastClose - lowest) / (highest - lowest)
  };
}

function findLargeMovements(klines) {
  return klines
    .map((item, index) => {
      const previous = klines[index - 1];
      const close = Number(item.close);
      const previousClose = Number(previous?.close);
      if (!previous || !Number.isFinite(close) || !Number.isFinite(previousClose) || previousClose === 0) {
        return null;
      }

      const changeRate = (close / previousClose) - 1;
      return Math.abs(changeRate) >= 0.05
        ? { date: item.date, changeRate: percentage(changeRate) }
        : null;
    })
    .filter(Boolean)
    .slice(-10);
}

function buildAnalysis(stock, klines, valuation) {
  const threeMonth = calculateWindowMetrics(klines, 63);
  const sixMonth = calculateWindowMetrics(klines, 126);
  const oneMonth = calculateWindowMetrics(klines, 21);

  return {
    code: stock.code,
    name: stock.name,
    source: stock.source || "unknown",
    currentPrice: Number(stock.now) || null,
    changeRateToday: percentage(Number(stock.percent)),
    marketHigh: Number(stock.high) || null,
    marketLow: Number(stock.low) || null,
    previousClose: Number(stock.yesterday) || null,
    dataAsOf: klines.at(-1)?.date || null,
    threeMonth,
    sixMonth,
    oneMonth,
    valuation,
    largeMovements: findLargeMovements(klines),
    limitations: [
      "仅凭价格数据不能确认波动原因，需要另接新闻、公告或财报数据源。"
    ]
  };
}

/**
 * 获取 A 股行情并计算分析所需的时间窗口指标。
 * stock-api 使用腾讯、新浪、东方财富自动兜底；本工具只负责取数和确定性计算，
 * 不让大模型自行计算价格区间和波动率。
 *
 * 输入约束：task 必须是 1-2000 个字符的字符串。
 * 输出约束：只返回程序计算的结构化数据；PE、新闻和波动原因缺失时返回限制说明。
 */
export function createStockAnalysisTool({ financialDataTool }) {
  return {
    name: "stock_analysis",

    async invoke({ task }) {
      const parsed = STOCK_TASK_SCHEMA.safeParse({ task });
      if (!parsed.success) {
        throw new StockToolError("股票分析问题不能为空，且长度不能超过 2000 个字符。", "STOCK_INPUT_ERROR");
      }

      try {
        const directCode = extractStockCode(parsed.data.task);
        const keyword = searchKeyword(parsed.data.task);
        const searchResults = directCode || !keyword
          ? []
          : await stocks.auto.searchStocks(keyword);
        const code = directCode || normalizeStockCode(searchResults[0]?.code);
        if (!code) {
          throw new StockToolError("未能识别 A 股代码，请提供股票名称或 6 位股票代码。", "STOCK_CODE_ERROR");
        }

        const [stock, klines, valuation] = await Promise.all([
          stocks.auto.getStock(code),
          stocks.auto.getKlines(code, { period: "day", count: 140, adjust: "qfq" }),
          financialDataTool.invoke({ code })
        ]);
        if (!stock || !Number(stock.now) || klines.length < 21) {
          throw new StockToolError(`暂时无法获取 ${code} 的有效行情数据，请稍后重试。`, "STOCK_DATA_UNAVAILABLE");
        }

        return buildAnalysis(stock, klines, valuation);
      } catch (error) {
        if (error instanceof StockToolError) {
          throw error;
        }

        throw new StockToolError("行情数据源暂时不可用，请稍后重试。", "STOCK_PROVIDER_ERROR");
      }
    }
  };
}

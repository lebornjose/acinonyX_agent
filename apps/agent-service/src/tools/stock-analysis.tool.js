/**
 * @file stock-analysis.tool.js
 * @description A 股行情数据工具。
 *
 * 职责：
 *   1. 识别用户问题是否需要实时行情（isStockAnalysisTask）
 *   2. 从问题中提取或搜索股票代码
 *   3. 通过同花顺金融数据 API 获取实时行情、前复权日 K 和估值数据
 *   5. 计算 1/3/6 个月的价格区间、涨跌幅、波动率等结构化指标，供写作 Agent 使用
 *
 * 设计原则：
 *   - 只做确定性计算，不让大模型自行计算价格和波动率
 *   - 数据缺失时返回 null 字段 + limitations 说明，不编造数据
 */

import { z } from "zod";

/**
 * 匹配股票代码的正则。
 * 支持带前缀（SH600036 / SZ000001）和纯数字（600036 / 000001）两种格式。
 * 纯数字格式只匹配以沪深板块特征开头的 6 位代码，避免误匹配普通数字。
 */
const STOCK_CODE_PATTERN = /\b(?:(?:SH|SZ|BJ)\d{6}|(?:60|68|00|30|83|87|92)\d{4})\b/i;

/**
 * 匹配"需要实时行情"意图的关键词正则。
 * 用于在没有明确股票代码时，判断用户是否想查询行情，
 * 避免"什么是市盈率"等概念类问题被误判为行情请求。
 */
const STOCK_REQUEST_PATTERN = /当前价格|股价|行情|走势|市盈率|PE|估值|涨跌|波动|分析.*股票|看看.*股票|分析一下/u;

// task 参数的最大允许长度（字符数）
const MAX_TASK_LENGTH = 2000;

/**
 * 请求参数校验 schema。
 * task 不能为空，且长度不能超过 MAX_TASK_LENGTH。
 */
const STOCK_TASK_SCHEMA = z.object({
  task: z.string().trim().min(1).max(MAX_TASK_LENGTH),
  symbolQuery: z.string().trim().min(1).max(64).optional()
});

/**
 * 股票工具专用错误类。
 * 携带 code 字段，方便上层按错误类型做分支处理或日志分类。
 */
export class StockToolError extends Error {
  /**
   * @param {string} message - 人类可读的错误描述
   * @param {string} [code]  - 机器可读的错误代码，默认 "STOCK_DATA_ERROR"
   */
  constructor(message, code = "STOCK_DATA_ERROR") {
    super(message);
    this.name = "StockToolError";
    this.code = code;
  }
}

/**
 * 判断用户问题是否需要调用实时行情数据。
 *
 * 触发条件（满足其一即可）：
 *   1. 问题中包含可识别的股票代码（带前缀或纯数字板块代码）
 *   2. 问题中既包含行情查询意图关键词，又包含长度 2-12 个中文字符的具体对象描述，
 *      且不是以"什么是"/"如何理解"开头的概念问题
 *
 * @param {string} task - 用户输入的问题文本
 * @returns {boolean} true 表示需要查询行情，false 表示不需要
 */
export function isStockAnalysisTask(task) {
  const text = String(task || "").trim();

  // 优先：只要问题里有股票代码，就直接触发行情查询
  if (STOCK_CODE_PATTERN.test(text)) {
    return true;
  }

  // 次选：同时满足"行情意图"和"具体对象"两个条件才触发，
  // 避免纯概念性问题（如"什么是 PE"）被误判
  const hasStockIntent = STOCK_REQUEST_PATTERN.test(text);
  const hasSpecificObject = /[\u4e00-\u9fff]{2,12}/u.test(text) && !/^什么是|^如何理解/u.test(text);
  return hasStockIntent && hasSpecificObject;
}

/**
 * 将用户输入的股票代码规范化为带市场前缀的 6 位格式。
 *
 * 规则：
 *   - 已有 SH/SZ 前缀：直接转大写
 *   - 60/68 开头：上交所主板/科创板 → 加 SH 前缀
 *   - 00/30 开头：深交所主板/创业板 → 加 SZ 前缀
 *   - 83/87/92 开头：北交所 → 加 BJ 前缀
 *   - 无法识别：返回空字符串
 *
 * @param {string} code - 原始股票代码
 * @returns {string} 规范化后的代码（如 SH600036），或空字符串
 */
function normalizeStockCode(code) {
  const normalized = String(code || "").trim().toUpperCase();

  const prefixedCode = normalized.match(/^(SH|SZ|BJ)(\d{6})$/u);
  if (prefixedCode) {
    return `${prefixedCode[2]}.${prefixedCode[1]}`;
  }

  // 上交所：主板（60xxxx）和科创板（68xxxx）
  if (/^(60|68)\d{4}$/u.test(normalized)) {
    return `${normalized}.SH`;
  }

  // 深交所：主板（00xxxx）和创业板（30xxxx）
  if (/^(00|30)\d{4}$/u.test(normalized)) {
    return `${normalized}.SZ`;
  }

  // 北交所：83/87/92 开头
  if (/^(83|87|92)\d{4}$/u.test(normalized)) {
    return `${normalized}.BJ`;
  }

  return "";
}

/**
 * 从用户问题文本中提取股票代码。
 * 优先匹配带 SH/SZ 前缀的格式，再尝试匹配纯数字板块代码。
 *
 * @param {string} task - 用户问题文本
 * @returns {string} 规范化后的股票代码，或空字符串（未找到）
 */
function extractStockCode(task) {
  // 优先匹配带前缀的代码（更精确）
  const prefixedCode = String(task || "").match(/\b(?:SH|SZ|BJ)\d{6}\b/i)?.[0];
  if (prefixedCode) {
    return normalizeStockCode(prefixedCode);
  }

  // 再尝试匹配纯数字板块代码（如 600036、000001）
  const plainCode = String(task || "").match(/\b(?:60|68|00|30|83|87|92)\d{4}\b/u)?.[0];
  return normalizeStockCode(plainCode);
}

/**
 * 从用户问题中提取搜索关键词，用于无代码时通过股票名称搜索。
 *
 * 处理方式：去除常见动词/副词/标点后，取第一个词组作为关键词。
 *
 * @param {string} task - 用户问题文本
 * @returns {string} 提取出的搜索关键词，可能为空字符串
 */
function searchKeyword(task) {
  return String(task || "")
    .replace(/当前价格|股价|行情|走势|市盈率|PE|估值|涨跌|波动|分析|一下|看看|最近|近[一三六个0-9]+个月|帮我|请|的|？|\?/giu, " ")
    .trim()
    .split(/\s+/u)[0];
}

/**
 * 过滤数组，只保留有限的数字值（排除 NaN、Infinity、undefined）。
 *
 * @param {Array<number|any>} values - 原始数值数组
 * @returns {number[]} 有限数字数组
 */
function finiteNumbers(values) {
  return values.filter((value) => Number.isFinite(value));
}

/**
 * 将小数比率转换为百分比数字。
 * 例如：0.05 → 5（表示 5%）。
 *
 * @param {number} value - 小数比率
 * @returns {number|null} 百分比数值；若 value 不是有限数则返回 null
 */
function percentage(value) {
  return Number.isFinite(value) ? value * 100 : null;
}

/**
 * 计算指定时间窗口内的行情统计指标。
 *
 * 计算内容：
 *   - 起止日期
 *   - 区间最高价、最低价
 *   - 区间涨跌幅（changeRate，%）
 *   - 区间波动率（volatility，%，用日收益率标准差 × sqrt(交易日数) 估算）
 *   - 当前价在区间内的相对位置（rangePosition，0=最低，1=最高）
 *
 * @param {Array<{date: string, close: string|number}>} klines - K 线数据数组（按日期升序）
 * @param {number} count - 取最后 count 根 K 线计算
 * @returns {object|null} 统计结果对象；数据不足时返回 null
 */
function calculateWindowMetrics(klines, count) {
  // 取最后 count 根 K 线
  const window = klines.slice(-count);

  // 提取有效收盘价
  const closes = finiteNumbers(window.map((item) => Number(item.close)));
  if (!closes.length) {
    return null;
  }

  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const highest = Math.max(...closes);
  const lowest = Math.min(...closes);

  // 计算每日收益率序列：(当日收盘 / 前日收盘) - 1
  const returns = closes.slice(1).map((close, index) => (close / closes[index]) - 1);

  // 日均收益率
  const averageReturn = returns.length
    ? returns.reduce((total, value) => total + value, 0) / returns.length
    : 0;

  // 日收益率方差
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
    // 区间总涨跌幅（%）
    changeRate: percentage((lastClose / firstClose) - 1),
    // 区间波动率：日标准差 × sqrt(交易日数)，近似年化前的相对波动水平（%）
    volatility: percentage(Math.sqrt(variance) * Math.sqrt(Math.max(returns.length, 1))),
    // 当前价格在区间内的相对位置（0 = 区间最低，1 = 区间最高）
    rangePosition: highest === lowest ? 0.5 : (lastClose - lowest) / (highest - lowest)
  };
}

/**
 * 找出最近交易日中涨跌幅绝对值 ≥ 5% 的大幅波动日。
 * 最多返回最近 10 条，避免数据过多。
 *
 * @param {Array<{date: string, close: string|number}>} klines - K 线数据（按日期升序）
 * @returns {Array<{date: string, changeRate: number}>} 大幅波动日列表
 */
function findLargeMovements(klines) {
  return klines
    .map((item, index) => {
      const previous = klines[index - 1];
      const close = Number(item.close);
      const previousClose = Number(previous?.close);

      // 第一根 K 线没有前日数据，或数值无效，跳过
      if (!previous || !Number.isFinite(close) || !Number.isFinite(previousClose) || previousClose === 0) {
        return null;
      }

      const changeRate = (close / previousClose) - 1;

      // 涨跌幅绝对值 ≥ 5% 才算大幅波动
      return Math.abs(changeRate) >= 0.05
        ? { date: item.date, changeRate: percentage(changeRate) }
        : null;
    })
    .filter(Boolean)   // 过滤掉 null（未达到阈值的日期）
    .slice(-10);        // 只保留最近 10 条
}

function formatShanghaiDate(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function normalizeKlines(items) {
  return items
    .map((item) => ({
      date: formatShanghaiDate(item.date_ms),
      close: item.close_price
    }))
    .filter((item) => Number.isFinite(Number(item.close)))
    .sort((first, second) => first.date.localeCompare(second.date));
}

function buildValuation(valuation) {
  const item = valuation.item;
  if (!item) {
    return {
      status: "unavailable",
      reason: "同花顺金融数据未返回该股票的估值指标。",
      current: null,
      sixMonthPeTtmRange: null
    };
  }

  return {
    status: "available",
    source: "hithink-finance",
    dataAsOf: valuation.timestamp ? formatShanghaiDate(valuation.timestamp) : null,
    current: {
      pe: Number.isFinite(item.pe_mrq) ? item.pe_mrq : null,
      peTtm: Number.isFinite(item.pe_ttm) ? item.pe_ttm : null,
      pb: Number.isFinite(item.pb_mrq) ? item.pb_mrq : null,
      totalMarketValue: null,
      circulatingMarketValue: null
    },
    sixMonthPeTtmRange: null
  };
}

function buildStockSnapshot(symbol, snapshot) {
  return {
    code: symbol.thscode,
    name: symbol.name,
    source: "hithink-finance",
    now: snapshot.last_price,
    percent: Number(snapshot.price_change_ratio_pct) / 100,
    high: snapshot.high_price,
    low: snapshot.low_price,
    yesterday: snapshot.prev_price
  };
}

/**
 * 将实时行情、K 线数据和估值指标整合为结构化分析对象。
 *
 * @param {object} stock      - 标准化后的同花顺行情快照
 * @param {Array}  klines     - 日 K 数据数组
 * @param {object} valuation  - financial_data 工具返回的估值指标
 * @returns {object} 结构化分析结果，供写作 Agent 使用
 */
function buildAnalysis(stock, klines, valuation) {
  // 分别计算 1/3/6 个月的时间窗口指标
  // A 股月均交易日约：1个月≈21日、3个月≈63日、6个月≈126日
  const threeMonth = calculateWindowMetrics(klines, 63);
  const sixMonth = calculateWindowMetrics(klines, 126);
  const oneMonth = calculateWindowMetrics(klines, 21);

  return {
    code: stock.code,
    name: stock.name,
    source: stock.source || "unknown",
    currentPrice: Number(stock.now) || null,              // 当前价格
    changeRateToday: percentage(Number(stock.percent)),    // 今日涨跌幅（%）
    marketHigh: Number(stock.high) || null,                // 今日最高价
    marketLow: Number(stock.low) || null,                  // 今日最低价
    previousClose: Number(stock.yesterday) || null,        // 昨日收盘价
    dataAsOf: klines.at(-1)?.date || null,                 // 数据截止日期
    threeMonth,    // 近 3 个月统计指标
    sixMonth,      // 近 6 个月统计指标
    oneMonth,      // 近 1 个月统计指标
    valuation,     // PE/PB/市值等估值指标（来自 financial_data 工具）
    largeMovements: findLargeMovements(klines),            // 近期大幅波动日
    limitations: [
      // 明确告知模型：仅凭价格数据无法解释波动原因
      "仅凭价格数据不能确认波动原因，需要另接新闻、公告或财报数据源。"
    ]
  };
}

/**
 * 创建 A 股行情分析工具实例。
 *
 * 本工具只负责取数和确定性计算，不让大模型自行计算价格区间和波动率。
 *
 * 输入约束：task 必须是 1-2000 个字符的字符串。
 * 输出约束：只返回程序计算的结构化数据；PE、新闻和波动原因缺失时返回限制说明。
 *
 * @param {object} options                      - 工厂参数
 * @param {object} options.financialDataTool    - financial_data 工具实例（用于获取 PE/PB）
 * @returns {{ name: string, invoke: Function, isStockAnalysisTask: Function }} 工具对象
 */
export function createStockAnalysisTool({ hithinkFinanceClient }) {
  return {
    name: "stock_analysis",

    /**
     * 执行股票行情分析。
     *
     * 流程：
     *   1. 校验 task 参数
     *   2. 从 task 中提取股票代码；若无代码则用名称搜索并消歧
     *   3. 并行获取实时行情、前复权日 K 数据、估值指标
     *   4. 校验数据有效性，返回结构化分析结果
     *
     * @param {object} params      - 调用参数
     * @param {string} params.task - 用户的完整问题文本
     * @returns {Promise<object>}  结构化行情分析对象
     * @throws {StockToolError}    输入无效、代码无法识别、数据源不可用时抛出
     */
    async invoke({ task, symbolQuery }) {
      // 参数校验：空字符串或超长输入直接拒绝
      const parsed = STOCK_TASK_SCHEMA.safeParse({ task, symbolQuery });
      if (!parsed.success) {
        throw new StockToolError("股票分析问题不能为空，且长度不能超过 2000 个字符。", "STOCK_INPUT_ERROR");
      }

      try {
        // 步骤一：尝试直接从问题中提取股票代码。
        const directCode = extractStockCode(parsed.data.task);
        const keyword = parsed.data.symbolQuery || searchKeyword(parsed.data.task);
        const resolvedQuery = directCode || keyword;

        if (!resolvedQuery) {
          throw new StockToolError("未能识别 A 股代码，请提供股票名称或 6 位股票代码。", "STOCK_CODE_ERROR");
        }

        // 步骤二：始终通过同花顺标的检索取得标准代码与名称。
        const symbol = await hithinkFinanceClient.resolveAshare(resolvedQuery);
        const end = Date.now();
        const start = end - (240 * 24 * 60 * 60 * 1000);

        // 步骤三：并行获取三类数据，减少总等待时间。
        const [snapshot, rawKlines, rawValuation] = await Promise.all([
          hithinkFinanceClient.getSnapshot(symbol.thscode),
          hithinkFinanceClient.getHistoricalPrices(symbol.thscode, start, end),
          hithinkFinanceClient.getValuation(symbol.thscode)
        ]);
        const klines = normalizeKlines(rawKlines);
        const stock = snapshot ? buildStockSnapshot(symbol, snapshot) : null;
        const valuation = buildValuation(rawValuation);

        // 步骤四：校验数据完整性。
        // stock.now 为 0 或无效说明行情未返回；klines < 21 则连 1 个月指标都无法计算
        if (!stock || !Number(stock.now) || klines.length < 21) {
          throw new StockToolError(`暂时无法获取 ${symbol.thscode} 的有效行情数据，请稍后重试。`, "STOCK_DATA_UNAVAILABLE");
        }

        // 步骤五：整合数据，返回结构化分析结果。
        return buildAnalysis(stock, klines, valuation);
      } catch (error) {
        // StockToolError 直接向上传递，保留原始错误类型和 code
        if (error instanceof StockToolError) {
          throw error;
        }

        if (String(error.code || "").startsWith("HITHINK_")) {
          throw new StockToolError(error.message, error.code);
        }

        // 其他未预期错误（网络异常、第三方库错误等）统一包装后抛出
        throw new StockToolError("同花顺金融数据源暂时不可用，请稍后重试。", "STOCK_PROVIDER_ERROR");
      }
    }
  };
}

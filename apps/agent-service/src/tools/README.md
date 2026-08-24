# Agent Tools

## 目录职责

`src/tools` 存放 Agent 调用的外部数据和业务工具。工具负责输入校验、外部调用、确定性计算和结构化输出；不负责用户认证、会话持久化、提示词拼接或最终答案生成。

## `stock-analysis.tool.js`

A 股行情分析工具，使用同花顺金融数据 API 的标的检索、行情快照、前复权日 K 与估值快照。

### 输入

```js
{
  task: "请问复星医药最近三个月走势怎么样？",
  symbolQuery: "复星医药"
}
```

约束：

- `task` 必须是非空字符串。
- 最大长度为 2000 个字符。
- 支持 `SH600519`、`SZ000001`、`BJ430047` 或六位 A 股代码。
- 支持传入股票名称；存在歧义时会列出候选并要求用户提供代码，不会默认选择首条。
- 正常工作流会先由 `stock_symbol` Agent 从中文问题提取 `symbolQuery`；工具只使用该值进行确定性检索，不负责语义理解。

### 输出

返回结构化行情分析对象，包含当前价格、数据源、数据日期、1/3/6 个月价格窗口、波动率和大幅波动日期。

- 百分比字段使用数值百分比，例如 `5.2` 表示 `5.2%`。
- `rangePosition` 是 0 到 1 的区间位置。
- `source` 固定为 `hithink-finance`。
- 新闻、公告和波动原因不在本工具返回范围内，不得由工具或 Agent 猜测。

### 错误码

| 错误码 | 含义 |
| --- | --- |
| `STOCK_INPUT_ERROR` | 输入为空或超过长度限制 |
| `STOCK_CODE_ERROR` | 无法识别股票代码或名称 |
| `STOCK_DATA_UNAVAILABLE` | 返回数据为空或历史数据不足 |
| `STOCK_PROVIDER_ERROR` | 同花顺金融数据服务调用失败 |

工具对外只抛出可读错误，不透传第三方接口响应、密钥或内部堆栈。

### 数据限制

工具需要 `HITHINK_FINANCE_API_KEY`，并使用前复权日线计算趋势；具体复权方式和数据日期必须在回答中说明。服务端检查响应体的 `code === 0`，不能只依据 HTTP 状态码判断成功。

## `hithink-finance.client.js`

同花顺金融数据 REST 客户端。Key 仅由 Agent Service 进程从环境变量读取，并以 `X-api-key` 请求头发给同花顺服务；不会传给浏览器、模型提示词或日志。

- `HITHINK_FINANCE_API_KEY`：必填。
- `HITHINK_FINANCE_BASE_URL`：可选，默认 `https://fuyao.aicubes.cn`。
- `HITHINK_FINANCE_TIMEOUT_MS`：可选，默认 10000 毫秒。

# API Rules

- 固定使用 Node.js + Express + mysql2；数据库配置从根 `.env` 读取。
- 遵守 `routes`、`controllers`、`services`、`repositories` 分层。
- 路由不得直接执行 SQL；SQL 必须位于 repository/database 层。
- 所有用户资源必须校验归属。
- 会话列表、详情、新增和删除接口必须按当前用户校验资源归属；删除不存在或不属于当前用户的会话统一返回 404。
- 资源创建时的 ID 必须由 Chat24 服务端自动生成；不得接受或使用请求体、查询参数或路径中的用户自定义 ID 作为新资源 ID。
- API 层与数据库交互时，时间字段统一使用 Unix 秒级整数时间戳，不得将 `Date` 对象或毫秒时间戳作为持久化值或接口约定。
- ID 生成必须统一调用 `src/utils/id.js`，Unix 秒级时间戳必须统一调用 `src/utils/time.js`；controller、service、repository 和 database 初始化代码不得自行调用 `randomUUID()` 或重复实现时间戳转换。
- AI 回复接口应优先返回结果，消息持久化在响应后异步执行；异步写入必须捕获错误并记录耗时，不得因为写库失败重复发送或改写已发送的响应。
- Agent 调用必须处理失败、超时和可追踪日志。
- 不得日志输出密码、Token、API Key 或完整用户消息。
- 修改后执行 JavaScript 语法检查并验证 `/api/health`。

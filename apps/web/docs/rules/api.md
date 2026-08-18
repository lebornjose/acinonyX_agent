# API 请求规则

- 所有请求必须通过 service 或 composable 发起。
- 所有 service 必须位于 `src/services/`，并从 `src/services/index.js` 对外导出。
- 按功能拆分 service 文件，禁止建立一个包含所有 API 的巨型 service 文件。
- 每个 service 文件必须有模块职责注释；每个导出的服务方法必须注释参数、返回值和错误/事件行为。
- 流式服务必须说明事件类型、连接关闭条件和异常处理方式。
- 禁止在模板中调用 `fetch`、`axios` 或直接处理 API 响应。
- 页面和组件不得直接访问 Agent Service 或数据库。
- 所有异步流程必须处理 `loading`、`empty`、`error`、`timeout` 和 `retry` 状态。
- 表单必须提供校验、提交中禁用、成功反馈和失败反馈；异步提交期间禁止重复提交。

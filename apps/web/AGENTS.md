# Web Client Rules

## 基础要求

- 固定使用 Vue 3 + Vite + Element Plus + Pinia。
- 后端请求只能通过 `src/services/` 访问 API 服务 `http://localhost:4001`。
- 不得保存 DeepSeek Key 或调用 Agent Service 内部接口。
- 修改后执行 `pnpm --filter web-client build`。

## Services 规则

- `src/services/` 是 Web 端所有 API 和外部服务请求的统一目录。
- `src/services/index.js` 是 services 对外的唯一出口；页面、组件和 store 只能从该入口导入服务。
- 每个功能建立独立服务文件，例如 `src/services/chat.service.js`、`src/services/user.service.js`、`src/services/conversation.service.js`。
- 新增 API 方法必须放入对应功能文件，禁止把所有请求堆在一个 service 文件中。
- 新增服务文件必须在 `src/services/index.js` 中显式导出。
- `src/services/` 内部文件可以互相引用私有辅助函数，但业务层不得绕过 `index.js` 直接导入具体服务文件。
- 服务层只负责请求、响应解析和错误标准化；页面状态、loading、重试和 UI 提示由页面或 composable 管理。
- 每个 service 文件必须有模块职责注释；每个对外导出的服务方法必须说明用途、参数、返回值和异常/事件行为。
- SSE、WebSocket 等长连接服务必须在注释中说明连接方式、事件名称、关闭条件和错误行为。
- 页面目录下禁止新建 `services/` 目录；页面专属请求也必须放在 `src/services/`，按功能命名。

## 规则索引

开始修改 Web 端代码前，必须阅读与任务相关的规则文件；任务涉及多个领域时，必须阅读所有相关规则文件。

- [架构与目录规则](docs/rules/architecture.md)
- [Vue 文件规则](docs/rules/vue.md)
- [组件规则](docs/rules/components.md)
- [API 请求规则](docs/rules/api.md)
- [状态管理规则](docs/rules/state-management.md)
- [安全与可访问性规则](docs/rules/security.md)
- [交付与验证规则](docs/rules/delivery.md)

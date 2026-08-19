# Agent Platform Harness Rules

这是整个 monorepo 的强制规则。修改任意文件前必须遵守本文件；进入子目录后，还必须遵守该目录最近的 `AGENTS.md`。

## 项目边界

- `apps/web`：Vue 3 用户端。
- `apps/admin`：Vue 3 管理端。
- `apps/api`：Express 业务后端、用户、会话、消息、权限和数据库访问。
- `apps/agent-service`：LangChain/LangGraph Agent 编排和模型调用。
- `packages/database`：Prisma/MySQL 数据模型。

## 强制架构约束

1. 前端不得直接调用 DeepSeek，必须调用 `apps/api`。
2. `apps/api` 是唯一允许直接访问 MySQL 的业务服务。
3. `app责s/agent-service` 不负用户认证、会话权限或 Admin 业务。
4. 数据库访问必须通过 repository/database 层，路由中禁止写 SQL。
5. 密钥、密码、Token 和真实用户数据不得写入源码、日志或提交记录。
6. 新功能必须同步更新接口、错误处理、文档和必要测试。
7. 不得重新引入根目录 `client/`；用户端只能放在 `apps/web`。
8. 所有项目资源的 ID 必须由 Chat24 在服务端自动生成，禁止由用户传入、指定或覆盖。
9. 所有数据库时间字段必须使用 Unix 秒级整数时间戳，不得使用 JavaScript `Date`、毫秒时间戳或 Prisma `DateTime` 作为持久化类型；时间单位和精度必须在 schema 与接口文档中保持一致。

## 统一规范

必须阅读并遵守 [docs/standards/code-style.md](docs/standards/code-style.md)。

- 所有代码必须保持人工可读，禁止将多个语句、分支或函数压缩到同一行。
- 禁止使用折叠式单行函数、单行 `try/catch`、单行路由注册和连续分号堆叠；每个逻辑步骤必须独占清晰的代码行。
- 单个函数体禁止超过 100 行（不含空行和注释）；超出时必须将内部逻辑提炼为独立的具名子函数，不得以注释分隔替代真正的模块化拆分。

## 规则执行要求

- `AGENTS.md` 中标记为“必须”的规则属于强制约束。
- 开始编码前先检查目标目录的规则文件。
- 完成修改后必须逐条自检相关规则；不能只运行语法检查。
- 如果规则与用户明确的新需求冲突，先说明冲突，再按用户本轮明确要求执行，并记录例外原因。

## 验证要求

- JavaScript：执行 `node --check <file>`。
- API：验证 `/api/health` 和数据库错误处理。
- Agent：验证模型配置缺失时有可读错误。
- Vue：执行对应 workspace 的 `pnpm build`。
- 数据库：检查 Prisma schema，确认结构变更可重复执行。

## 变更纪律

- 先检查现有代码和配置，再修改。
- 保留用户已有改动，不覆盖无关文件。
- 不执行破坏性命令，不删除数据或数据库表，除非用户明确要求。
- 完成后说明修改文件、验证结果和未解决问题。

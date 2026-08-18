# 股票知识 Agent

一个基于 Vue 3、Element Plus、Express、MySQL、Prisma、LangChain.js 和 LangGraph 的股票知识问答 Agent。

它面向希望学习和理解股票市场的用户，支持用中文解答股票基础知识、财务指标、公司基本面、行业研究、估值方法、技术分析、交易规则与投资风险等问题。对于涉及实时行情、个股数据或最新政策的问题，Agent 会提示信息时点和数据核验要求；它不承诺收益，也不替代持牌投资顾问或用户的独立决策。

项目采用 pnpm monorepo 管理多个应用和共享包。

## 项目结构

```text
apps/
├── web/              # Vue + Vite + Element Plus 用户聊天端（5173）
├── admin/            # Vue + Vite + Element Plus 管理端（5174）
├── api/              # Express 业务后端（4001）
└── agent-service/    # LangChain/LangGraph Agent 服务（4002）
packages/database/    # Prisma + MySQL 数据模型
scripts/start.js      # 外层执行入口
```

`apps/api` 是标准 Express 分层项目：

```text
apps/api/src/
├── app.js                 # Express 应用装配
├── server.js              # 启动、关闭、数据库初始化
├── config/env.js          # 环境变量
├── database/mysql.js      # MySQL 连接池和建表
├── routes/                # 路由
├── controllers/           # HTTP 控制器
├── services/              # 跨模块业务服务
├── repositories/          # MySQL 数据访问
├── middleware/            # 鉴权、错误处理
└── utils/                 # 通用工具
```

## 服务职责

- `web`：股票知识问答、用户聊天和会话展示。
- `admin`：用户和会话管理入口。
- `api`：用户、会话、消息和 Admin API；通过内部接口调用 Agent。
- `agent-service`：只负责股票知识 Agent 的编排、研究与答案生成，以及可配置模型调用。
- `packages/database/schema.prisma`：MySQL 数据模型。

## 配置

```bash
corepack enable
pnpm install
cp .env.example .env
```

配置 DeepSeek 和 MySQL：

```env
LLM_API_KEY=your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
DATABASE_URL=mysql://root:password@localhost:3306/agent_platform
```

## 安装与初始化

```bash
pnpm install
pnpm install:db
```

MySQL 数据库准备好后，可以执行：

```bash
pnpm --filter @agent-platform/database db:push
```

业务 API 已通过 `mysql2/promise` 连接 MySQL，启动时会自动创建 `users`、`conversations`、`messages` 三张基础表，并将聊天记录写入 MySQL。`packages/database/schema.prisma` 同时保留 Prisma 数据模型，后续可以将 SQL Repository 迁移为 Prisma Repository。

## 启动

启动完整平台（Web、Admin、业务 API、Agent 服务）：

```bash
pnpm start
```

外层入口会同时启动：

```text
Web：http://localhost:5173
Admin：http://localhost:5174
API：http://localhost:4001
Agent：http://localhost:4002
```

启动用户端：

```bash
pnpm dev:web
```

启动 Admin：

```bash
pnpm dev:admin
```

访问：

```text
用户端：http://localhost:5173
Admin：http://localhost:5174
API：http://localhost:4001/api/health
Agent：http://localhost:4002/internal/health
```

## 主要接口

```text
POST /api/auth/login
GET  /api/me
GET  /api/conversations
POST /api/conversations
GET  /api/conversations/:id
POST /api/conversations/:id/messages
GET  /api/admin/users
GET  /api/admin/conversations
POST /internal/agent/run
```

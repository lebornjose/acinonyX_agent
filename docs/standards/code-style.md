# Unified Code Style

## 通用

- 使用清晰具体的命名，避免含义不明的变量。
- 代码必须便于人工阅读；禁止一行书写多个语句、多个函数调用或多个控制流分支。
- 禁止折叠代码：函数、条件、异常处理、路由注册和对象配置应使用清晰的多行格式。
- 一个函数只承担一个主要职责；复杂逻辑拆分为可测试函数。
- 优先早返回；错误必须显式处理，不得静默吞错。
- 不提交调试输出、注释掉的大段旧代码或未使用依赖。
- 注释解释原因和约束，不重复代码本身。

## JavaScript / Node.js

- 使用 ESM `import` / `export`，不新增 CommonJS `require`。
- 使用 `async/await`。
- 外部输入必须校验和规范化。
- 环境变量集中读取，不在业务代码中散落配置。
- 数据库、HTTP、文件操作必须处理失败和资源释放。

## Express API

- `routes` 只定义路径和中间件。
- `controllers` 只负责请求解析和响应编排。
- `services` 负责业务流程和跨模块调用。
- `repositories` 负责数据库读写。
- 响应格式保持稳定：失败返回 `{ error: string }`。

## Vue / Element Plus

- 使用 Vue 3 Composition API；新页面优先 `<script setup>`。
- Vue 单文件组件的区块顺序固定为 `<template>`、`<script>`、`<style>`；缺少某个区块时保持其余区块的相对顺序。
- 页面、组件、API 请求、状态管理分离。
- 异步操作必须有 loading、empty、error 状态。
- 破坏性操作必须确认；表单必须校验并反馈结果。
- 基础控件优先使用 Element Plus。
- 单文件不得超过 500 行；达到 450 行必须评估拆分。
- 公共组件放在 `src/components`，单页面组件放在对应页面目录。
- 公共方法放在 `src/utils` 的独立文件，并统一从 `src/utils/index.js` 导出。
- 新增工具或组件前必须搜索已有实现，禁止重复定义相同公共能力。

## 数据库

- 表名和字段使用 snake_case。
- 所有表必须有主键；关联字段必须有索引和删除策略。
- 所有资源 ID 由 Chat24 服务端自动生成，禁止使用用户提交的 ID 创建或覆盖资源。
- 时间统一使用 Unix 时间戳持久化；不得在 Prisma schema 中使用 `DateTime`，不得把 JavaScript `Date` 作为数据库字段或接口的时间约定。
- 结构变更必须可迁移、可回滚或可重复执行。
- 密码只能存哈希值，不能存明文。

## Git / 依赖

- 使用 pnpm workspace；不要在子项目使用 npm 安装依赖。
- 新依赖安装到实际使用它的 workspace。
- `.env`、`node_modules`、构建产物和日志不得提交。

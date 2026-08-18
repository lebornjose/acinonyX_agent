# Database Package Rules

- MySQL 使用 Prisma schema 作为数据结构统一来源。
- 所有模型必须明确主键、关联、索引和时间字段。
- 所有模型主键和资源 ID 必须由 Chat24 自动生成，禁止依赖用户输入或允许用户覆盖；生成策略必须在 schema 中显式声明。
- 所有时间字段必须使用 Unix 秒级整数时间戳持久化，禁止使用 Prisma `DateTime`、数据库 `DATETIME`/`TIMESTAMP` 或 JavaScript `Date` 作为模型字段类型；统一的时间单位和精度必须在 schema 与 repository 中明确。
- 数据库字段使用 snake_case，JavaScript 字段使用 camelCase 映射。
- 不保存密码明文、API Key 或不必要的敏感原文。
- 结构变更必须更新 schema、迁移说明和 repository。
- 修改后执行 `pnpm --filter @agent-platform/database db:generate`。

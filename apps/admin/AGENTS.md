# Admin Client Rules

- 固定使用 Vue 3 + Vite + Element Plus。
- 只能通过 API 获取数据，不得直接连接 MySQL 或 Agent Service。
- 页面必须处理权限失败、空数据、加载和错误状态。
- 删除、禁用、修改配置必须二次确认并反馈结果。
- 页面放在 `src/views`，通用组件放在 `src/components`。
- 修改后执行 `pnpm --filter admin-client build`。

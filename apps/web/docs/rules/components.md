# 组件规则

- 公共组件必须定义清晰的 Props、Emits 和插槽约定，禁止通过隐式全局状态传递业务数据。
- 公共组件不得直接请求业务 API，由页面或 composable 获取数据后通过 Props 传入。
- 组件文件名使用 PascalCase，例如 `MessageBubble.vue`、`EmptyState.vue`。
- 同类 UI 结构出现两次以上时，应评估抽取为公共组件。
- 只使用一次的页面专属组件放在对应 `src/views/<feature>/components/` 目录。
- 页面文件达到 450 行时必须评估拆分，超过 500 行时必须拆分组件。
- 拆分后页面根组件只负责编排，不得通过移动代码制造另一个超过 500 行的文件。

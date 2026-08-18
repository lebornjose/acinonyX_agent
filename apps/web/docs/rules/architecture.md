# 架构与目录规则

## 项目结构

```text
src/
├── assets/              # Vite 处理的图片、字体和样式资源
├── components/          # 跨页面复用的公共组件
├── layouts/             # 页面布局
├── router/              # 路由和导航守卫
├── services/            # 跨页面 API 请求
├── stores/              # Pinia 全局状态
├── utils/               # 跨业务公共纯函数
├── views/               # 页面级组件
├── App.vue
└── main.js
```

- 页面组件放在 `src/views`，公共组件放在 `src/components`，请求放在 `src/services`，可复用响应式逻辑放在 `src/composables`。
- `views/<feature>/` 是页面业务根目录；页面专属组件和 composable 可以放在该目录下的 `components/`、`composables/`，所有请求统一放在 `src/services/`。
- `src/components/` 只放跨两个及以上页面或业务模块使用的组件。
- `src/composables/` 放跨页面复用的 composable；页面私有 composable 放在对应页面目录。
- `src/stores/` 只放跨页面全局状态；页面局部状态留在页面或 composable 中。
- `src/utils/` 只放跨页面、跨业务的纯公共方法；页面私有工具放在页面目录内。
- 页面之间禁止直接导入彼此的内部组件、私有 composable 或私有 service。
- `src/services/index.js` 是 services 唯一对外出口，业务代码禁止直接导入 `src/services/*.service.js`。
- 单个页面同时包含 UI、请求、状态和格式化逻辑时，必须拆分为 view、composable、service 和 component。

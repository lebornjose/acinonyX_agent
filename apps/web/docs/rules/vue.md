# Vue 文件规则

- `.vue` 文件区块顺序固定为 `<template>`、`<script setup>`、`<style scoped>`；缺少区块时保持其余区块的相对顺序。
- 页面样式默认使用 `<style scoped>`，全局样式只能放在 `src/style.css`。
- 使用 Vue 3 Composition API，新页面优先使用 `<script setup>`。
- 页面组件只负责编排；包含多个异步流程或超过 3 个相关响应式状态时，应评估拆分 composable。
- 模板中不得执行复杂计算。
- 列表渲染必须使用稳定的 `key`，禁止使用 `index` 作为长期列表 key。

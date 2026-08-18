---
name: orange-book-principles
description: 《Agent Skills 橙皮书》项目级实践规范。用于设计、实现和验证 agent-service 的 Skills、Agents 与 LangGraph 工作流。
---

# Agent Skills 橙皮书实践规范

本 Skill 用于开发阶段指导 Codex，不是 agent-service 运行时依赖。修改 `apps/agent-service` 时，先遵守本文件，再按任务需要读取 `references/` 中的详细规范。

## 核心原则

1. **模块化优先**：一个 Skill 只解决一个稳定、可复用的问题。
2. **先定义契约**：先写触发条件、输入、输出、限制和失败行为，再写实现。
3. **渐进式披露**：核心流程放在 `SKILL.md`，细节和长材料放在 `references/`。
4. **以示例验证规则**：每条重要规则至少有一个应通过和一个应拒绝的例子。
5. **开发规范与运行能力分离**：本 Skill 指导开发；业务 Skill 才由 agent-service 在运行时加载。

## agent-service 工作流

新增或修改 Agent/Skill 时按以下顺序执行：

1. 阅读仓库根目录及目标目录的 `AGENTS.md` 和代码规范。
2. 明确状态字段、Agent 职责、Skill 触发条件及输入输出。
3. 选择合适模式：单一 Skill 用 Checklist，多个步骤用 Pipeline，多 Agent 协作用 Swarm。
4. 实现配置、Skill 加载、Agent 和 Graph；HTTP 层只做校验、编排和错误映射。
5. 用验证样例检查触发、输出、边界和失败路径。
6. 执行项目要求的语法检查、健康检查和相关测试。

详细模板见 `references/skill-design.md`，验证流程见 `references/skill-validation.md`，架构约束见 `references/agent-service-patterns.md`。

## 快速判断

- ✅ “识别粉煤灰行业问题并按固定字段输出”：适合独立业务 Skill。
- ✅ “先检索、再提炼、最后写作”：适合 Pipeline Graph。
- ❌ “把所有行业知识、格式要求和工具说明放入一个超长 Skill”：应拆分并渐进加载。
- ❌ “在路由中直接读取 Skill 文件、拼接 Prompt 或访问数据库”：违反 agent-service 分层约束。

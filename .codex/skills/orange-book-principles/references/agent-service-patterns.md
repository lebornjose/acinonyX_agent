# agent-service 集成约束

```text
config     -> 读取环境变量、创建模型
skills     -> 加载和选择业务 Skill
agents     -> 单一职责，消费 Skill 和任务
graphs     -> 状态、节点、边和路由，只负责编排
runtime    -> 组装模型、Skill、Agent 和 Graph
server     -> HTTP 校验、SSE/JSON 响应和错误映射
```

- Agent 不得直接读取 `process.env`、访问数据库或实现用户权限。
- Graph 不拼接业务 Prompt；Prompt 组装应在 Agent 或 Skill 适配层完成。
- Skill 加载失败必须显式失败，不得静默使用伪造内容。
- 模型提供商、模型、Base URL 和运行参数必须来自配置。
- 客户端不得覆盖服务端 API Key。
- 跨请求状态、会话持久化和用户数据由 `apps/api` 负责。

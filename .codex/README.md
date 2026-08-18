# Codex Project Harness

```text
.codex/
├── config.toml       # 项目级 Codex 配置
└── rules/
    ├── commands.rules # 常用开发命令
    └── guards.rules   # 高风险命令审批
```

代码规范和目录职责仍然写在根目录及各应用的 `AGENTS.md` 中；`.rules` 只负责命令权限和安全边界，不替代代码规范。

提交前确认：

- 不在这里写 API Key、数据库密码或用户数据。
- 新增允许命令时尽量使用精确命令前缀。
- 删除、数据库重置、强制 Git 操作保持 `prompt`，不要默认放行。

# 配置示例 | Configuration Examples

本目录包含可直接使用的配置示例。

This directory contains ready-to-use configuration examples.

## 可用示例 | Available Examples

| 文件 File         | 说明 Description                           |
| ----------------- | ------------------------------------------ |
| `statusline.json` | 自定义状态行配置 Custom status line config |

---

## statusline.json

显示丰富的会话状态信息：

Shows rich session status information:

```
koala:~/projects/myapp main* ctx:73% opus 14:30 todos:3
│     │                 │     │       │     │     └── 待办数量 Todo count
│     │                 │     │       │     └── 当前时间 Current time
│     │                 │     │       └── 模型名称 Model name
│     │                 │     └── 上下文剩余 Context remaining
│     │                 └── Git 分支 + 脏状态 Branch + dirty status
│     └── 工作目录 Working directory
└── 用户名 Username
```

### 使用方法 | Usage

1. 确保安装了 `jq` 工具
   Ensure `jq` is installed

2. 复制 `statusLine` 对象到 `~/.claude/settings.json`
   Copy the `statusLine` object to `~/.claude/settings.json`

```json
{
  "statusLine": {
    "type": "command",
    "command": "...",
    "description": "Custom status line"
  }
}
```

### 平台支持 | Platform Support

| 平台 Platform      | 支持 Support                  |
| ------------------ | ----------------------------- |
| macOS              | ✓ 完全支持 Full support       |
| Linux              | ✓ 完全支持 Full support       |
| Windows + WSL      | ✓ WSL 内支持 Supported in WSL |
| Windows (Git Bash) | ⚠️ 部分支持 Partial support   |

### 依赖 | Dependencies

- `jq` - JSON 处理工具 JSON processor
- `git` - 获取分支信息 For branch info

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Windows (via Chocolatey)
choco install jq
```

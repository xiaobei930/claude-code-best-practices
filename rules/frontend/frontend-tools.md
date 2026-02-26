---
paths:
  - "**/*.vue"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.ts"
  - "**/*.js"
  - "e2e/**"
---

# 前端验证工具（Playwright）| Frontend Verification Tools

> 本文件从 [common/methodology.md](../common/methodology.md) 提取，提供 Playwright 浏览器工具的使用规范。

### Core Tools | 核心工具

| Tool 工具                  | Purpose 用途                    | Use Case 使用场景                         |
| -------------------------- | ------------------------------- | ----------------------------------------- |
| `browser_navigate`         | Navigate to URL 导航到 URL      | Open target page 打开目标页面             |
| `browser_snapshot`         | Get page structure 获取页面结构 | Check element existence 检查元素存在性    |
| `browser_take_screenshot`  | Screenshot 截图                 | Record verification results 记录验证结果  |
| `browser_console_messages` | Console logs                    | Check frontend errors 检查前端错误        |
| `browser_click`            | Click element 点击元素          | Interaction testing 交互测试              |
| `browser_type`             | Input text 输入文本             | Form testing 表单测试                     |
| `browser_wait_for`         | Wait for condition 等待条件     | Async operation verification 异步操作验证 |

### When to Use | 使用时机

- **Dev self-test Dev 自测**: Quick verification after frontend code completion 前端代码完成后快速验证
- **QA acceptance QA 验收**: Frontend functionality completeness testing 前端功能完整性测试
- **Bug location Bug 定位**: Screenshot + Console logs assist debugging 截图 + Console 日志辅助调试

### Permission Configuration | 权限配置

Add in `settings.local.json` (refer to `settings.local.json.example`)
需在 `settings.local.json` 中添加（参考 `settings.local.json.example`）

### Screenshot Management | 截图管理

| Config 配置                    | Description 说明                                    |
| ------------------------------ | --------------------------------------------------- |
| **Directory 存放目录**         | `.claude/screenshots/`                              |
| **Git ignore**                 | Configured in `.gitignore` 已在 `.gitignore` 中配置 |
| **Naming convention 命名规范** | `{page-name}-{timestamp}.png`                       |
| **Cleanup timing 清理时机**    | After `/clear` or `/cc-best:checkpoint`             |

Example 截图示例：

```bash
browser_take_screenshot → .claude/screenshots/login-page-20250122.png
```

### Login State Handling | 登录状态处理

For projects requiring login 对于需要登录的项目：

**Method 1: Manual login (Recommended) 手动登录（推荐）**

```
1. browser_navigate to login page 到登录页
2. Manually complete login in the popup browser 手动在弹出的浏览器中完成登录
3. Browser will maintain session state after login 登录后浏览器会保持会话状态
4. Subsequent operations auto-reuse that session 后续操作自动复用该会话
```

**Method 2: Automated login 自动化登录**

```
1. browser_navigate to login page 到登录页
2. browser_type username/password (read from env vars) 输入用户名/密码（从环境变量读取）
3. browser_click login button 点击登录按钮
4. browser_wait_for login completion 等待登录完成
```

**Notes 注意事项**：

- Don't hardcode credentials, use environment variables 凭证不要硬编码，使用环境变量
- Add login state files to `.gitignore` 登录状态文件加入 `.gitignore`
- Delete sensitive operation screenshots promptly 敏感操作截图及时删除

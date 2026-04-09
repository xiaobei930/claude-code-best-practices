# OWASP 安全模式详解

本文件包含 OWASP Top 10 的详细防护模式和代码示例，从 SKILL.md 提取。

## 1. 密钥管理

```typescript
// ✅ 环境变量
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY 未配置");
```

- [ ] 无硬编码的 API 密钥、Token 或密码
- [ ] 所有密钥在环境变量中
- [ ] `.env.local` 在 .gitignore 中
- [ ] Git 历史中无密钥

## 2. 输入验证

```typescript
import { z } from "zod";
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
});
```

### 文件上传验证

检查：大小（5MB 限制）、MIME 类型（白名单）、扩展名（白名单）

## 3. SQL 注入防护

```typescript
// ✅ 参数化查询
await db.query("SELECT * FROM users WHERE email = $1", [userEmail]);
```

## 4. 认证与授权

- JWT Token 存储在 httpOnly cookies（非 localStorage）
- 敏感操作前验证授权
- 实现基于角色的访问控制

```typescript
res.setHeader(
  "Set-Cookie",
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`,
);
```

## 5. XSS 防护

- 用 DOMPurify 净化用户 HTML
- 配置 CSP 头（Content-Security-Policy）
- 使用框架内置 XSS 防护

## 6. CSRF 防护

- 状态变更操作需 CSRF Token
- Cookie 使用 SameSite=Strict
- 双重提交 Cookie 模式

## 7. 速率限制

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,
});
// 搜索等昂贵操作: 10/分钟
```

## 8. 敏感数据暴露

- 日志中无密码、Token 或密钥
- 用户看到通用错误消息，详细错误仅在服务器日志
- 堆栈跟踪不暴露给用户

## 9. 依赖安全

```bash
npm audit          # 检查漏洞
npm audit fix      # 修复
npm outdated       # 检查过期包
```

- [ ] 无已知漏洞
- [ ] Lock 文件已提交
- [ ] 启用 Dependabot

## 10. 命令注入防护

使用 `execFile` / `subprocess.run(shell=False)` 替代 `exec` / `os.system`，不拼接用户输入到命令字符串。

## 11. 路径遍历防护

使用 `os.path.basename()` 或 `path.basename()` 过滤文件名，不直接拼接用户提供的路径。

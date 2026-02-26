---
paths:
  - "e2e/**"
  - "playwright.config.*"
  - "**/*.spec.ts"
  - "**/*.spec.js"
---

# E2E 测试规范（Playwright）| E2E Testing Rules

> 前端 E2E 测试的 Playwright 规范。与 [frontend-testing.md](./frontend-testing.md) 配合使用。

### 目录结构

```
e2e/
├── tests/
│   ├── auth.spec.ts        # 认证流程
│   ├── checkout.spec.ts    # 结账流程
│   └── search.spec.ts      # 搜索功能
├── pages/                  # 页面对象
│   ├── LoginPage.ts
│   └── HomePage.ts
├── fixtures/               # 测试数据
│   └── users.json
└── playwright.config.ts
```

### 页面对象模式

```typescript
// pages/LoginPage.ts
import { Page, Locator } from "@playwright/cc-best:test";

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel("邮箱");
    this.passwordInput = page.getByLabel("密码");
    this.submitButton = page.getByRole("button", { name: "登录" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

### 测试示例

```typescript
// tests/auth.spec.ts
import { test, expect } from "@playwright/cc-best:test";
import { LoginPage } from "../pages/LoginPage";

test.describe("用户认证", () => {
  test("成功登录后跳转到首页", async ({ page }) => {
    // Arrange
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Act
    await loginPage.login("user@example.com", "password123");

    // Assert
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("欢迎")).toBeVisible();
  });

  test("错误密码显示错误提示", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login("user@example.com", "wrong-password");

    await expect(page.getByText("密码错误")).toBeVisible();
  });
});
```

### 等待策略

```typescript
// ✅ 推荐：使用语义化等待
await page.getByRole("button").click();
await expect(page.getByText("加载完成")).toBeVisible();

// ✅ 等待网络请求完成
await Promise.all([
  page.waitForResponse("**/api/users"),
  page.getByText("保存").click(),
]);

// ❌ 避免：硬编码等待
await page.waitForTimeout(3000); // 不稳定
```

### 配置示例

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/cc-best:test";

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 30 * 1000,
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry", // 失败时保存 trace
    screenshot: "only-on-failure", // 失败时截图
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 运行命令

```bash
npx playwright test                 # 运行所有测试
npx playwright test --ui            # UI 模式（调试）
npx playwright test --headed        # 显示浏览器
npx playwright test auth.spec.ts    # 指定文件
npx playwright show-report          # 查看报告
npx playwright codegen              # 录制生成代码
```

### E2E 最佳实践

- **隔离测试数据** - 每个测试使用独立数据，避免相互影响
- **使用页面对象** - 封装页面操作，提高可维护性
- **语义化选择器** - 优先 `getByRole`、`getByLabel`，避免脆弱的 CSS 选择器
- **合理的等待** - 使用 `expect().toBeVisible()` 而非固定等待
- **并行运行** - 配置 `workers` 加速测试
- **失败时保存证据** - 截图、视频、trace 便于排查

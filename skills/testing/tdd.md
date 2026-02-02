# TDD 测试驱动开发模式

测试驱动开发工作流指南，确保所有代码开发遵循 TDD 原则，实现全面的测试覆盖。

## 触发条件

- 编写新功能或特性
- 修复 Bug（先写复现 Bug 的测试）
- 重构现有代码
- 添加 API 端点
- 创建新组件
- 实现核心业务逻辑

## 与角色系统的配合

| 角色    | TDD 使用场景                  |
| ------- | ----------------------------- |
| `/cc-best:lead` | 定义测试策略、审查测试覆盖率  |
| `/cc-best:dev`  | 执行 TDD 循环、编写测试和实现 |
| `/cc-best:qa`   | 补充边界测试、E2E 测试        |

**典型流程**：

```
/cc-best:lead → 定义接口和测试策略
  ↓
/cc-best:dev → TDD 循环（RED → GREEN → REFACTOR）
  ↓
/cc-best:qa → 验证覆盖率、补充边界测试
  ↓
/cc-best:commit → 提交代码和测试
```

---

## 核心原则

### 1. 测试先于代码

**永远**先写测试，再写实现代码使测试通过。

### 2. TDD 循环

```
RED → GREEN → REFACTOR → REPEAT

RED:      写一个失败的测试
GREEN:    写最少的代码使测试通过
REFACTOR: 改进代码，保持测试绿色
REPEAT:   下一个场景
```

### 3. 覆盖率要求

| 代码类型     | 覆盖率要求 |
| ------------ | ---------- |
| 普通业务代码 | 80%+       |
| 金融计算     | 100%       |
| 认证逻辑     | 100%       |
| 安全关键代码 | 100%       |
| 核心业务逻辑 | 100%       |

---

## 参考资源

> 📚 **详细示例和框架配置请参阅子文件：**
>
> - [完整 TDD 示例](./tdd-example.md) - 从需求到实现的完整会话
> - [测试框架与配置](./frameworks.md) - Mock 模式、覆盖率配置、常用命令

---

## 必须测试的边界情况

| 类型           | 示例                      | 测试目的   |
| -------------- | ------------------------- | ---------- |
| Null/Undefined | `null`, `undefined`       | 空值处理   |
| 空值           | `""`, `[]`, `{}`          | 空集合处理 |
| 边界值         | `0`, `1`, `-1`, `MAX_INT` | 边界行为   |
| 类型错误       | 传入错误类型              | 类型防御   |
| 网络错误       | 请求失败、超时            | 错误恢复   |
| 并发           | 同时多个请求              | 竞态条件   |
| 大数据         | 10000+ 条记录             | 性能边界   |
| 特殊字符       | Unicode、Emoji、SQL 注入  | 安全边界   |

---

## 示例对比

### TDD 循环实践

#### ❌ DON'T - 跳过 RED 阶段

```typescript
// 错误：直接写实现，然后补测试
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// 事后补的测试，可能遗漏边界情况
test("计算总价", () => {
  expect(calculateTotal([{ price: 10, quantity: 2 }])).toBe(20);
});
```

**问题**: 测试可能只覆盖已实现的路径，遗漏边界情况

#### ✅ DO - 完整 TDD 循环

```typescript
// 1. RED: 先写失败测试
describe("calculateTotal", () => {
  test("空数组返回0", () => {
    expect(calculateTotal([])).toBe(0);
  });

  test("单个商品计算正确", () => {
    expect(calculateTotal([{ price: 10, quantity: 2 }])).toBe(20);
  });

  test("多个商品累加正确", () => {
    expect(
      calculateTotal([
        { price: 10, quantity: 2 },
        { price: 5, quantity: 3 },
      ]),
    ).toBe(35);
  });
});

// 2. GREEN: 写最少代码使测试通过
// 3. REFACTOR: 优化代码
```

**原因**: 测试先行确保覆盖所有场景，驱动出更好的设计

---

### 测试粒度

#### ❌ DON'T - 测试实现细节

```typescript
// 错误：测试内部状态
test("点击后状态更新", () => {
  const component = render(<Counter />);
  fireEvent.click(screen.getByRole("button"));
  expect(component.state.count).toBe(1); // 依赖内部实现
});
```

**问题**: 内部重构会导致测试失败，但功能没变

#### ✅ DO - 测试用户可见行为

```typescript
// 正确：测试用户看到的结果
test("点击后显示更新的计数", () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("计数: 1")).toBeInTheDocument();
});
```

**原因**: 测试用户关心的行为，重构时测试稳定

---

### 测试独立性

#### ❌ DON'T - 测试相互依赖

```typescript
// 错误：依赖前一个测试的状态
let userId: string;

test("创建用户", async () => {
  const result = await createUser({ name: "Test" });
  userId = result.id; // 共享状态
});

test("更新用户", async () => {
  await updateUser(userId, { name: "Updated" }); // 依赖上一个测试
});
```

**问题**: 测试顺序依赖，单独运行会失败

#### ✅ DO - 测试相互独立

```typescript
// 正确：每个测试独立设置数据
test("创建用户", async () => {
  const result = await createUser({ name: "Test" });
  expect(result.id).toBeDefined();
});

test("更新用户", async () => {
  // 独立创建测试数据
  const user = await createUser({ name: "Test" });
  const result = await updateUser(user.id, { name: "Updated" });
  expect(result.name).toBe("Updated");
});
```

**原因**: 每个测试可独立运行，并行执行更快

---

### 选择器策略

#### ❌ DON'T - 脆弱的选择器

```typescript
// 错误：依赖 CSS 类名或结构
await page.click(".btn-primary");
await page.click("div > form > button:nth-child(2)");
```

**问题**: CSS 或 DOM 结构变化导致测试失败

#### ✅ DO - 语义化选择器

```typescript
// 正确：使用语义化选择器
await page.click('button:has-text("提交")');
await page.click('[data-testid="submit-button"]');
await page.getByRole("button", { name: "提交" }).click();
```

**原因**: 基于语义选择，UI 重构时更稳定

---

### Mock 策略

#### ❌ DON'T - 过度 Mock

```typescript
// 错误：Mock 了所有东西，测试没有意义
jest.mock("./utils");
jest.mock("./validators");
jest.mock("./formatters");

test("处理数据", () => {
  // 全是 mock，没有测试真实逻辑
});
```

**问题**: 没有测试真实行为，只测试了 mock 的配置

#### ✅ DO - 只 Mock 外部依赖

```typescript
// 正确：只 mock 外部依赖
jest.mock("./api"); // 只 mock API 调用

test("处理数据", () => {
  mockApi.fetchData.mockResolvedValue(testData);

  const result = processData(testData); // 真实的处理逻辑

  expect(result).toEqual(expectedResult);
});
```

**原因**: 测试真实业务逻辑，只隔离外部依赖

---

## 测试质量检查清单

### 提交前检查

- [ ] 所有公共函数有单元测试
- [ ] 所有 API 端点有集成测试
- [ ] 关键用户流程有 E2E 测试
- [ ] 边界情况已覆盖（null、空、无效）
- [ ] 错误路径已测试（不只是 happy path）
- [ ] 外部依赖已 Mock
- [ ] 测试相互独立（无共享状态）
- [ ] 测试名称描述清晰
- [ ] 断言具体且有意义
- [ ] 覆盖率达到 80%+

### 持续集成

```bash
# 推荐的 CI 命令
npm test -- --coverage --ci --reporter=dot
```

---

## 最佳实践

1. **测试先行** - 始终 TDD，先写测试
2. **单一断言** - 每个测试聚焦一个行为
3. **描述性命名** - 清楚说明测试什么
4. **AAA 模式** - Arrange-Act-Assert 结构
5. **Mock 外部依赖** - 隔离单元测试
6. **测试边界** - null、undefined、空、大值
7. **测试错误路径** - 不只测试 happy path
8. **保持快速** - 单元测试 < 50ms
9. **清理副作用** - 测试后无残留
10. **审查覆盖报告** - 识别盲点

---

## 成功指标

- ✅ 80%+ 代码覆盖率
- ✅ 所有测试通过（绿色）
- ✅ 无跳过或禁用的测试
- ✅ 快速执行（单元测试 < 30s）
- ✅ E2E 覆盖关键用户流程

---

**记住**：测试不是可选项。它是支持自信重构、快速开发和生产可靠性的安全网。

> **TDD 格言**：没有测试的代码就是遗留代码。

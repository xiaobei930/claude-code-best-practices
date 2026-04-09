# 前端通用模式

本文件包含框架无关的前端开发模式，从 SKILL.md 提取。

## 组件分类

```
┌─────────────────────────────────────────────────────┐
│                    组件金字塔                         │
├─────────────────────────────────────────────────────┤
│  页面组件 (Pages/Views) — 路由和布局                 │
│  功能组件 (Features/Containers) — 业务逻辑           │
│  UI 组件 (Presentational) — 纯展示，通过 props 接收  │
│  基础组件 (Base/Primitives) — Button, Input 等       │
└─────────────────────────────────────────────────────┘
```

### 组件设计原则

| 原则             | 说明                        |
| ---------------- | --------------------------- |
| **单一职责**     | 一个组件只做一件事          |
| **Props 向下**   | 数据从父组件流向子组件      |
| **Events 向上**  | 事件从子组件通知父组件      |
| **组合优于继承** | 使用 slot/children 组合组件 |
| **可预测**       | 相同 props 产生相同输出     |

### 命名规范

```
components/
├── ui/       # 基础组件（PascalCase）: Button, Input, Card
├── feature/  # 功能组件: UserCard, OrderList
└── layout/   # 布局组件: Header, Sidebar
```

## 状态管理模式

### 状态分层

| 层级           | 范围     | 存储方式      | 示例              |
| -------------- | -------- | ------------- | ----------------- |
| **组件状态**   | 单个组件 | useState/ref  | 表单输入、UI 状态 |
| **共享状态**   | 多个组件 | Context/Store | 用户信息、主题    |
| **服务器状态** | 来自 API | Query Cache   | 列表数据、详情    |
| **URL 状态**   | 路由参数 | Router        | 页码、筛选条件    |
| **持久状态**   | 跨会话   | localStorage  | 用户偏好          |

### 选择策略

```
简单共享状态 → Context/Provide
中等应用 → Pinia/Zustand
大型应用 → Redux/Vuex + 规范化
API 请求 → TanStack Query（自动缓存、重验证、乐观更新）
```

## 性能优化模式

### 渲染优化

| 技术               | 用途         | 框架实现                          |
| ------------------ | ------------ | --------------------------------- |
| **Memoization**    | 避免重复计算 | useMemo/computed                  |
| **Lazy Loading**   | 延迟加载组件 | lazy/defineAsyncComponent         |
| **Virtual List**   | 大列表渲染   | react-window/vue-virtual-scroller |
| **Code Splitting** | 按需加载代码 | 动态 import                       |

### 资源优化

- 响应式图片（srcset）+ 懒加载（loading="lazy"）+ 现代格式（WebP/AVIF）
- Tree Shaking + Bundle 分析 + 预加载关键资源 + 延迟非关键脚本

## 无障碍模式 (a11y)

### 基础清单

- [ ] **语义化 HTML** — 使用正确的元素（button, nav, main...）
- [ ] **键盘可访问** — 所有交互可用键盘完成
- [ ] **焦点管理** — 焦点顺序合理，焦点可见
- [ ] **ARIA 标签** — 为动态内容添加适当标签
- [ ] **颜色对比** — 符合 WCAG 2.1 AA 标准（4.5:1）
- [ ] **替代文本** — 图片有 alt，图标有 aria-label

### 常见 ARIA 模式

```html
<button aria-label="关闭菜单" aria-expanded="false">
  <Icon name="close" aria-hidden="true" />
</button>
<input
  aria-labelledby="label-id"
  aria-describedby="hint-id"
  aria-invalid="true"
/>
<div aria-live="polite">加载完成</div>
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">...</div>
```

### 键盘交互

| 元素    | 按键        | 行为     |
| ------- | ----------- | -------- |
| 按钮    | Enter/Space | 激活     |
| 菜单    | ↑↓          | 移动焦点 |
| 对话框  | Esc         | 关闭     |
| Tab列表 | ←→          | 切换标签 |

## 表单模式

### 表单验证

```
客户端验证: 实时验证(onChange) + 提交验证(onSubmit)
验证库: React → react-hook-form + zod / Vue → vee-validate + zod
```

### 表单状态

```
{ values, errors, touched, isSubmitting, isValid }
```

- 字段错误用 `aria-invalid` + `aria-describedby` 关联错误消息
- 表单级错误用 `role="alert"`

## 动画模式

| 类型      | 用途           | 实现               |
| --------- | -------------- | ------------------ |
| 进入/退出 | 元素出现/消失  | CSS Transition     |
| 状态变化  | hover/active   | CSS Transition     |
| 列表动画  | 添加/删除/排序 | FLIP 动画          |
| 页面切换  | 路由过渡       | 路由动画           |
| 复杂动画  | 多阶段         | Framer Motion/GSAP |

**原则**: 有意义、快速(150-300ms)、可禁用(`prefers-reduced-motion`)、不阻塞

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

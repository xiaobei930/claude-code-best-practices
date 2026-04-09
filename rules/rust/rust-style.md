---
description: "Rust 编码风格：命名、格式化、惯用模式"
paths:
  - "**/*.rs"
---

# Rust 代码风格规则 | Rust Style Rules

> 本文件扩展 [common/coding-standards.md](../common/coding-standards.md)，提供 Rust 特定风格规范

## 格式化

- 使用 `rustfmt` 自动格式化，遵循项目 `rustfmt.toml` 配置
- 行宽默认 100 字符
- 使用 `cargo fmt --check` 在 CI 中验证

## 命名规范

- 函数/变量/模块: `snake_case`
- 类型/Trait/枚举: `PascalCase`
- 常量/静态变量: `UPPER_SNAKE_CASE`
- 生命周期参数: 短小有意义，如 `'a`、`'ctx`、`'de`

## 模块结构

```
src/
├── main.rs / lib.rs    # 入口文件
├── config.rs           # 配置模块
├── error.rs            # 统一错误类型
├── models/             # 数据模型
│   └── mod.rs
└── services/           # 业务逻辑
    └── mod.rs
```

## 错误类型设计

```rust
// ✅ 使用 thiserror 定义领域错误
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("数据库查询失败: {0}")]
    Database(#[from] sqlx::Error),

    #[error("资源未找到: {resource} id={id}")]
    NotFound { resource: &'static str, id: i64 },

    #[error("参数验证失败: {0}")]
    Validation(String),
}

// ✅ 应用层使用 anyhow 简化错误传播
use anyhow::{Context, Result};

fn load_config() -> Result<Config> {
    let content = std::fs::read_to_string("config.toml")
        .context("读取配置文件失败")?;
    toml::from_str(&content).context("解析配置文件失败")
}
```

## Trait 设计原则

- 保持 Trait 小而专注，遵循接口隔离原则
- 优先为 Trait 提供默认实现
- 使用关联类型而非泛型参数（当类型唯一确定时）

## 生命周期标注

```rust
// ✅ 明确标注生命周期关系
struct Parser<'input> {
    source: &'input str,
    position: usize,
}

// ✅ 省略规则适用时无需标注
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}
```

## 文档注释

````rust
/// 处理用户请求并返回响应
///
/// # Arguments
///
/// * `request` - 用户请求数据
///
/// # Errors
///
/// 当请求验证失败或数据库不可用时返回错误
///
/// # Examples
///
/// ```
/// let response = handle_request(request).await?;
/// assert!(response.is_success());
/// ```
pub async fn handle_request(request: Request) -> Result<Response> {
    todo!()
}
````

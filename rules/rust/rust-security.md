---
paths:
  - "**/*.rs"
---

# Rust 安全规范 | Rust Security Rules

> 本文件扩展 [common/security.md](../common/security.md)，提供 Rust 特定安全规范

## 禁止操作

### 禁止无必要的 unsafe 块

```rust
// ❌ 不必要的 unsafe，安全代码可以实现
unsafe {
    let ptr = vec.as_ptr();
    let value = *ptr.add(index);
}

// ✅ 使用安全的索引访问
let value = vec.get(index).expect("索引越界");

// ✅ 必须使用 unsafe 时，添加 SAFETY 注释说明前置条件
// SAFETY: 调用方保证 ptr 有效且已对齐，生命周期不超过 buffer
unsafe {
    std::ptr::read(ptr)
}
```

### 禁止忽略整数溢出

```rust
// ❌ 默认算术在 release 模式下会静默溢出
let result = a + b;

// ✅ 使用 checked/saturating/wrapping 明确溢出行为
let result = a.checked_add(b).ok_or(AppError::Overflow)?;
let clamped = a.saturating_add(b);  // 溢出时返回最大值
```

### 禁止拼接用户输入构建命令

```rust
// ❌ 命令注入风险
use std::process::Command;
let output = Command::new("sh")
    .arg("-c")
    .arg(format!("echo {}", user_input))
    .output()?;

// ✅ 直接传参，避免 shell 解析
let output = Command::new("echo")
    .arg(&user_input)
    .output()?;
```

---

## 必须遵守

### 最小化 unsafe 范围

```rust
// ❌ unsafe 块过大，包含不需要 unsafe 的代码
unsafe {
    let len = compute_length(&data);  // 安全代码
    let ptr = data.as_mut_ptr();
    *ptr.add(len - 1) = 0;
}

// ✅ 只在必要语句上使用 unsafe
let len = compute_length(&data);
// SAFETY: len > 0 已由 compute_length 保证
unsafe { *data.as_mut_ptr().add(len - 1) = 0 };
```

### 输入验证

```rust
use validator::Validate;

#[derive(Debug, Validate, Deserialize)]
pub struct CreateUserRequest {
    #[validate(length(min = 2, max = 50))]
    pub name: String,

    #[validate(email)]
    pub email: String,

    #[validate(range(min = 0, max = 150))]
    pub age: u8,
}

// ✅ 在处理函数入口验证
pub async fn create_user(req: CreateUserRequest) -> Result<User> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    // ... 业务逻辑
}
```

### 密钥管理

```rust
// ❌ 硬编码密钥
const API_KEY: &str = "sk-xxxxxxxxxxxx";

// ✅ 从环境变量读取
use std::env;

fn get_api_key() -> Result<String> {
    env::var("API_KEY").context("API_KEY 环境变量未设置")
}
```

---

## 推荐做法

### 依赖安全审计

```bash
# 使用 cargo-audit 检查已知漏洞
cargo install cargo-audit
cargo audit

# 在 CI 中集成
cargo audit --deny warnings

# 使用 cargo-deny 检查许可证和安全
cargo install cargo-deny
cargo deny check
```

### 内存安全最佳实践

- 优先使用引用（`&T`/`&mut T`）而非裸指针（`*const T`/`*mut T`）
- 使用 `Vec`、`String` 等安全容器管理内存
- 避免在 FFI 边界泄漏内存，确保每次分配都有对应的释放
- 使用 `Pin` 固定自引用结构体

### 缓冲区安全

```rust
// ✅ 使用安全的切片操作
let slice = data.get(start..end).ok_or(AppError::OutOfBounds)?;

// ✅ 使用 bytes crate 处理网络协议
use bytes::{Buf, BytesMut};

fn read_frame(buf: &mut BytesMut) -> Result<Frame> {
    if buf.remaining() < 4 {
        return Err(AppError::InsufficientData);
    }
    let len = buf.get_u32() as usize;
    if buf.remaining() < len {
        return Err(AppError::InsufficientData);
    }
    Ok(Frame::parse(buf.split_to(len)))
}
```

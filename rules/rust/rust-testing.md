---
description: "Rust 测试规范：单元测试、集成测试、属性测试"
paths:
  - "**/*.rs"
---

# Rust 测试规范 | Rust Testing Rules

> 本文件扩展 [common/testing.md](../common/testing.md)，提供 Rust 特定测试规范

## 单元测试（模块内 #[cfg(test)]）

```rust
// ✅ 在同一文件底部编写单元测试
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_input_returns_expected() {
        let result = parse("hello world");
        assert_eq!(result, ParsedData { word_count: 2 });
    }

    #[test]
    #[should_panic(expected = "空输入")]
    fn test_parse_empty_input_panics() {
        parse("");
    }

    #[test]
    fn test_validate_email_with_invalid_format_returns_error() {
        let result = validate_email("not-an-email");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("格式"));
    }
}
```

## 集成测试

```
tests/
├── integration_api.rs      # API 集成测试
├── integration_db.rs       # 数据库集成测试
└── common/
    └── mod.rs              # 共享测试工具
```

```rust
// tests/common/mod.rs — 共享测试辅助函数
pub fn setup_test_db() -> TestDb {
    // 创建测试数据库连接
    TestDb::new("sqlite::memory:")
}

// tests/integration_api.rs
mod common;

#[tokio::test]
async fn test_create_user_returns_201() {
    let db = common::setup_test_db();
    let app = create_app(db).await;
    let response = app.post("/users").json(&new_user()).await;
    assert_eq!(response.status(), 201);
}
```

## 测试命名规范

- 格式: `test_<功能>_<场景>_<预期结果>`
- 示例: `test_transfer_insufficient_balance_returns_error`

## 断言宏

```rust
// 常用断言
assert_eq!(actual, expected);           // 相等比较
assert_ne!(actual, unexpected);         // 不相等
assert!(condition);                     // 布尔条件
assert!(result.is_ok());               // Result 成功
assert!(result.is_err());              // Result 失败

// ✅ 使用 assert! 配合自定义消息
assert!(value > 0, "期望正数，实际得到: {}", value);
```

## 属性测试（proptest）

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_encode_decode_roundtrip(input in "\\PC*") {
        let encoded = encode(&input);
        let decoded = decode(&encoded).unwrap();
        prop_assert_eq!(input, decoded);
    }

    #[test]
    fn test_sort_preserves_length(mut vec in prop::collection::vec(any::<i32>(), 0..100)) {
        let original_len = vec.len();
        vec.sort();
        prop_assert_eq!(vec.len(), original_len);
    }
}
```

## 基准测试

```rust
// benches/benchmark.rs — 使用 criterion
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_parse(c: &mut Criterion) {
    let input = "测试数据".repeat(1000);
    c.bench_function("parse_large_input", |b| {
        b.iter(|| parse(black_box(&input)))
    });
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
```

## 运行命令

```bash
cargo test                          # 运行所有测试
cargo test --lib                    # 仅单元测试
cargo test --test integration_api   # 指定集成测试
cargo test -- --nocapture           # 显示 println 输出
cargo test -p my_crate              # 指定 crate
cargo bench                         # 运行基准测试
```

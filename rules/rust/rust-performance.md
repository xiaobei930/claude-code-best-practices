---
paths:
  - "**/*.rs"
---

# Rust 性能优化规范 | Rust Performance Rules

> 本文件扩展 [common/performance.md](../common/performance.md)，提供 Rust 特定性能规范

## 禁止操作

### 禁止不必要的克隆

```rust
// ❌ 无意义的 clone，增加堆分配
fn process(data: &Vec<String>) {
    let copied = data.clone();  // 深拷贝整个 Vec
    for item in &copied {
        println!("{}", item);
    }
}

// ✅ 直接使用引用
fn process(data: &[String]) {
    for item in data {
        println!("{}", item);
    }
}

// ✅ 需要所有权时，让调用方决定
fn process(data: Vec<String>) {
    for item in data {
        consume(item);
    }
}
```

### 禁止在循环中重复分配

```rust
// ❌ 每次循环创建新的 String
for item in items {
    let mut result = String::new();
    result.push_str(&format!("item: {}", item));
    results.push(result);
}

// ✅ 预分配缓冲区复用
let mut buf = String::with_capacity(256);
for item in items {
    buf.clear();
    write!(buf, "item: {}", item).unwrap();
    results.push(buf.clone());
}
```

---

## 必须遵守

### 所有权与借用最佳实践

```rust
// ✅ 函数参数优先使用借用
fn calculate_total(prices: &[f64]) -> f64 {
    prices.iter().sum()
}

// ✅ 使用 Cow 实现按需克隆
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains('\t') {
        Cow::Owned(input.replace('\t', "    "))
    } else {
        Cow::Borrowed(input)  // 无需分配
    }
}
```

### 迭代器优先于索引循环

```rust
// ❌ 索引循环，无法自动向量化优化
let mut sum = 0;
for i in 0..data.len() {
    sum += data[i];  // 每次都有边界检查
}

// ✅ 使用迭代器，编译器可优化掉边界检查
let sum: i64 = data.iter().sum();

// ✅ 链式迭代器，惰性求值
let result: Vec<_> = items.iter()
    .filter(|item| item.is_active())
    .map(|item| item.transform())
    .collect();
```

### 异步运行时选择

```rust
// ✅ Tokio — 生产首选，生态最完善
#[tokio::main]
async fn main() -> Result<()> {
    let listener = TcpListener::bind("0.0.0.0:8080").await?;
    // ...
}

// ✅ 合理配置运行时
let runtime = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(num_cpus::get())
    .enable_all()
    .build()?;
```

### 零拷贝模式

```rust
// ✅ 使用 &str 而非 String 避免分配
fn find_keyword<'a>(text: &'a str, keyword: &str) -> Option<&'a str> {
    text.find(keyword).map(|i| &text[i..i + keyword.len()])
}

// ✅ 使用 bytes::Bytes 实现零拷贝切片
use bytes::Bytes;

let data = Bytes::from(raw_data);
let header = data.slice(0..16);   // 引用计数，无拷贝
let payload = data.slice(16..);
```

---

## 推荐做法

### 减少堆分配

```rust
// ✅ 使用 SmallVec 优化小集合（栈上分配）
use smallvec::SmallVec;

let mut tags: SmallVec<[&str; 8]> = SmallVec::new();
tags.push("rust");  // 8 个以内在栈上

// ✅ 使用 ArrayString 替代短字符串
use arrayvec::ArrayString;

let mut key: ArrayString<32> = ArrayString::new();
write!(key, "user:{}", user_id).unwrap();

// ✅ 预分配容器容量
let mut results = Vec::with_capacity(items.len());
let mut map = HashMap::with_capacity(expected_size);
```

### 性能分析工具

```bash
# flamegraph — 火焰图分析
cargo install flamegraph
cargo flamegraph --bin my_app

# criterion — 基准测试回归检测
cargo bench

# perf（Linux）— 系统级性能分析
perf record --call-graph=dwarf cargo run --release
perf report

# DHAT（堆分析）
cargo run --features dhat-heap
```

### 编译优化配置

```toml
# Cargo.toml
[profile.release]
opt-level = 3         # 最高优化级别
lto = "fat"           # 链接时优化
codegen-units = 1     # 单编译单元，更好优化
strip = true          # 去除调试符号
panic = "abort"       # 减小二进制体积
```

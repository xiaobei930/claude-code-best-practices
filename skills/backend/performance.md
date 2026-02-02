# 后端性能优化模式

后端服务性能优化的最佳实践，涵盖数据库、缓存、并发和资源管理。

## 性能优化原则

### 核心理念

1. **测量优先** - 不要猜测，先 profiling
2. **瓶颈聚焦** - 优化 20% 的代码解决 80% 的问题
3. **渐进优化** - 小步迭代，每次只改一个变量
4. **权衡取舍** - 性能 vs 可读性 vs 复杂度

### 优化顺序

```
1. 算法优化 (O(n²) → O(n log n))
   ↓
2. 数据库优化 (索引、查询)
   ↓
3. 缓存策略 (Redis、内存)
   ↓
4. 并发优化 (异步、并行)
   ↓
5. 资源优化 (连接池、内存)
```

---

## 数据库性能

### 查询优化

#### 索引策略

```sql
-- ✅ 复合索引：高选择性列在前
CREATE INDEX idx_orders_user_status ON orders(user_id, status, created_at);

-- ❌ 避免：低选择性列在前
CREATE INDEX idx_orders_status ON orders(status);  -- status 只有几种值
```

#### 查询模式

```python
# ❌ N+1 查询问题
for user in users:
    orders = db.query(Order).filter_by(user_id=user.id).all()

# ✅ 预加载关联数据
users = db.query(User).options(joinedload(User.orders)).all()
```

```python
# ❌ 全量加载
all_records = db.query(Record).all()

# ✅ 分页查询
records = db.query(Record).limit(100).offset(page * 100).all()
```

### 连接池配置

```python
# SQLAlchemy 连接池
engine = create_engine(
    DATABASE_URL,
    pool_size=10,           # 保持的连接数
    max_overflow=20,        # 超出 pool_size 后可创建的最大连接
    pool_timeout=30,        # 获取连接的超时时间
    pool_recycle=1800,      # 连接回收时间（秒）
    pool_pre_ping=True,     # 使用前检查连接有效性
)
```

### 慢查询诊断

```sql
-- PostgreSQL: 开启慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1秒

-- MySQL: 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- 分析执行计划
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

---

## 缓存策略

### 缓存层级

```
┌─────────────────────────────────────────────────────┐
│  L1: 进程内缓存 (LRU Cache)                          │
│  ├─ 延迟: < 1ms                                      │
│  └─ 适用: 热点数据、配置                              │
├─────────────────────────────────────────────────────┤
│  L2: 分布式缓存 (Redis)                              │
│  ├─ 延迟: 1-5ms                                      │
│  └─ 适用: 会话、Token、频繁查询结果                   │
├─────────────────────────────────────────────────────┤
│  L3: 数据库查询缓存                                  │
│  ├─ 延迟: 5-50ms                                     │
│  └─ 适用: 复杂聚合查询                               │
└─────────────────────────────────────────────────────┘
```

### 缓存模式

#### Cache-Aside (旁路缓存)

```python
def get_user(user_id: int) -> User | None:
    # 1. 先查缓存
    cache_key = f"user:{user_id}"
    cached = redis.get(cache_key)
    if cached:
        return User.parse_raw(cached)

    # 2. 缓存未命中，查数据库
    user = db.query(User).get(user_id)
    if user:
        # 3. 写入缓存
        redis.setex(cache_key, 3600, user.json())

    return user
```

#### Write-Through (写穿透)

```python
def update_user(user_id: int, data: dict) -> User:
    # 1. 更新数据库
    user = db.query(User).get(user_id)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()

    # 2. 同步更新缓存
    cache_key = f"user:{user_id}"
    redis.setex(cache_key, 3600, user.json())

    return user
```

#### 缓存失效策略

```python
# TTL 过期
redis.setex(key, ttl_seconds, value)

# 主动失效
def invalidate_user_cache(user_id: int):
    redis.delete(f"user:{user_id}")
    redis.delete(f"user:{user_id}:orders")

# 批量失效（使用 pattern）
def invalidate_user_related(user_id: int):
    keys = redis.keys(f"user:{user_id}:*")
    if keys:
        redis.delete(*keys)
```

### 防止缓存穿透

```python
# 布隆过滤器防止查询不存在的数据
from pybloom_live import BloomFilter

user_bloom = BloomFilter(capacity=1000000, error_rate=0.001)

def get_user_safe(user_id: int) -> User | None:
    # 布隆过滤器快速判断
    if user_id not in user_bloom:
        return None

    # 正常缓存查询流程
    return get_user(user_id)
```

---

## 并发优化

### 异步 I/O

```python
# ❌ 同步串行
def fetch_all_data():
    user = fetch_user()       # 100ms
    orders = fetch_orders()   # 200ms
    products = fetch_products()  # 150ms
    return user, orders, products  # 总计 450ms

# ✅ 异步并发
async def fetch_all_data():
    user, orders, products = await asyncio.gather(
        fetch_user(),
        fetch_orders(),
        fetch_products(),
    )
    return user, orders, products  # 总计 ~200ms
```

### 并发控制

```python
# 信号量限制并发数
semaphore = asyncio.Semaphore(10)

async def fetch_with_limit(url: str):
    async with semaphore:
        return await fetch(url)

# 批量处理时限制并发
async def process_batch(items: list, batch_size: int = 100):
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        await asyncio.gather(*[process(item) for item in batch])
        await asyncio.sleep(0.1)  # 避免压垮下游
```

### 线程池 / 进程池

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# I/O 密集型：线程池
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(fetch_url, urls))

# CPU 密集型：进程池
with ProcessPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(compute_heavy, data_chunks))
```

---

## 资源管理

### 内存优化

```python
# ❌ 一次性加载大数据
all_records = list(db.query(Record).all())

# ✅ 生成器流式处理
def stream_records():
    for record in db.query(Record).yield_per(1000):
        yield record

# ✅ 使用 __slots__ 减少内存占用
class User:
    __slots__ = ['id', 'name', 'email']

    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email
```

### 连接资源管理

```python
# HTTP 连接池
import httpx

# 复用 client 实例
client = httpx.AsyncClient(
    limits=httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
    ),
    timeout=httpx.Timeout(10.0, connect=5.0),
)

# 确保关闭
async def cleanup():
    await client.aclose()
```

### 超时控制

```python
import asyncio

async def fetch_with_timeout(url: str, timeout: float = 5.0):
    try:
        async with asyncio.timeout(timeout):
            return await fetch(url)
    except asyncio.TimeoutError:
        logger.warning(f"请求超时: {url}")
        raise ServiceUnavailableError("请求超时")
```

---

## 性能监控

### 关键指标

| 指标           | 说明               | 目标值   |
| -------------- | ------------------ | -------- |
| **P50 延迟**   | 中位数响应时间     | < 100ms  |
| **P99 延迟**   | 99% 请求的响应时间 | < 500ms  |
| **吞吐量**     | 每秒处理请求数     | 根据业务 |
| **错误率**     | 错误请求占比       | < 0.1%   |
| **CPU 使用率** | 处理器占用         | < 70%    |
| **内存使用率** | 内存占用           | < 80%    |

### Profiling 工具

```python
# Python: cProfile
import cProfile
cProfile.run('main()', 'output.prof')

# 可视化
# pip install snakeviz
# snakeviz output.prof

# 内存分析
# pip install memory_profiler
from memory_profiler import profile

@profile
def memory_heavy_function():
    ...
```

### 日志埋点

```python
import time
import structlog

logger = structlog.get_logger()

async def timed_operation(name: str):
    start = time.perf_counter()
    try:
        result = await do_operation()
        return result
    finally:
        elapsed = time.perf_counter() - start
        logger.info(
            "操作完成",
            operation=name,
            duration_ms=round(elapsed * 1000, 2),
        )
```

---

## 语言专项优化

### Python

```python
# 使用 lru_cache 缓存计算结果
from functools import lru_cache

@lru_cache(maxsize=1000)
def expensive_computation(n: int) -> int:
    ...

# 使用列表推导式而非循环
# ❌
result = []
for x in data:
    result.append(x * 2)

# ✅
result = [x * 2 for x in data]
```

### Go

```go
// 预分配切片容量
// ❌
var result []int
for _, v := range data {
    result = append(result, v*2)
}

// ✅
result := make([]int, 0, len(data))
for _, v := range data {
    result = append(result, v*2)
}

// 使用 sync.Pool 复用对象
var bufferPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}
```

### Java

```java
// 使用 StringBuilder 而非 String 拼接
// ❌
String result = "";
for (String s : items) {
    result += s;
}

// ✅
StringBuilder sb = new StringBuilder();
for (String s : items) {
    sb.append(s);
}

// 使用并行流
list.parallelStream()
    .filter(x -> x > 0)
    .map(x -> x * 2)
    .collect(Collectors.toList());
```

---

## 性能检查清单

### 数据库

- [ ] 关键查询有合适的索引
- [ ] 无 N+1 查询问题
- [ ] 大表查询使用分页
- [ ] 连接池配置合理

### 缓存

- [ ] 热点数据已缓存
- [ ] 缓存失效策略明确
- [ ] 有防止缓存穿透措施
- [ ] 缓存容量有限制

### 并发

- [ ] I/O 操作使用异步
- [ ] 并发数有合理限制
- [ ] 超时控制已配置
- [ ] 资源正确释放

### 监控

- [ ] 关键指标有监控
- [ ] 慢查询日志已开启
- [ ] 错误有告警
- [ ] 定期 profiling

---

## Maintenance

- Sources: 各语言官方性能指南、数据库优化文档
- Last updated: 2025-02
- Pattern: 分层优化 + 语言专项

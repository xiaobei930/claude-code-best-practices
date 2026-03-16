---
paths:
  - "**/*.go"
---

# Go 性能优化规范 | Go Performance Rules

> 本文件扩展 [common/performance.md](../common/performance.md)，提供 Go 特定性能规范

## 禁止操作

### 禁止 goroutine 泄漏

```go
// ❌ goroutine 永远阻塞，无法退出
func process() {
    ch := make(chan int)
    go func() {
        result := <-ch  // 永远阻塞，无人发送
        fmt.Println(result)
    }()
    // 函数返回，goroutine 泄漏
}

// ✅ 使用 context 控制 goroutine 生命周期
func process(ctx context.Context) {
    ch := make(chan int, 1)
    go func() {
        select {
        case result := <-ch:
            fmt.Println(result)
        case <-ctx.Done():
            return  // 上下文取消时安全退出
        }
    }()
}
```

### 禁止无缓冲 channel 在高吞吐场景

```go
// ❌ 无缓冲 channel 导致生产者/消费者互相阻塞
ch := make(chan Task)

// ✅ 根据场景设置合理缓冲
ch := make(chan Task, 100)
```

---

## 必须遵守

### context 传播与取消

```go
// ✅ 所有 IO 操作接受 context 参数
func FetchData(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, fmt.Errorf("创建请求失败: %w", err)
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("请求失败: %w", err)
    }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}

// ✅ 设置超时上下文
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
data, err := FetchData(ctx, apiURL)
```

### sync.Pool 复用对象

```go
// ✅ 复用频繁创建的临时对象，减少 GC 压力
var bufferPool = sync.Pool{
    New: func() interface{} {
        return bytes.NewBuffer(make([]byte, 0, 4096))
    },
}

func processRequest(data []byte) string {
    buf := bufferPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufferPool.Put(buf)
    }()
    buf.Write(data)
    return buf.String()
}
```

### 数据库连接池

```go
import "database/sql"

// ✅ 合理配置连接池参数
db, err := sql.Open("postgres", dsn)
if err != nil {
    log.Fatal(err)
}

db.SetMaxOpenConns(25)              // 最大打开连接数
db.SetMaxIdleConns(10)              // 最大空闲连接数
db.SetConnMaxLifetime(5 * time.Minute)  // 连接最大存活时间
db.SetConnMaxIdleTime(1 * time.Minute)  // 空闲连接最大存活时间
```

### 减少内存分配

```go
// ❌ 循环中拼接字符串
var result string
for _, s := range items {
    result += s  // 每次分配新字符串
}

// ✅ 使用 strings.Builder
var builder strings.Builder
builder.Grow(estimatedSize)  // 预分配
for _, s := range items {
    builder.WriteString(s)
}
result := builder.String()

// ✅ 预分配切片容量
results := make([]Result, 0, len(items))
for _, item := range items {
    results = append(results, process(item))
}
```

---

## 推荐做法

### Worker Pool 模式

```go
func processItems(ctx context.Context, items []Item, workers int) []Result {
    jobs := make(chan Item, len(items))
    results := make(chan Result, len(items))

    // 启动 worker
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for item := range jobs {
                select {
                case <-ctx.Done():
                    return
                case results <- process(item):
                }
            }
        }()
    }

    // 发送任务
    for _, item := range items {
        jobs <- item
    }
    close(jobs)

    // 等待完成
    go func() { wg.Wait(); close(results) }()

    var out []Result
    for r := range results {
        out = append(out, r)
    }
    return out
}
```

### pprof 性能分析

```go
import _ "net/http/pprof"

// ✅ 开发环境启用 pprof 端点
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

```bash
# CPU 分析
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# 内存分析
go tool pprof http://localhost:6060/debug/pprof/heap

# goroutine 分析
go tool pprof http://localhost:6060/debug/pprof/goroutine

# 可视化火焰图
go tool pprof -http=:8080 cpu.prof
```

### 编译优化

```bash
# 构建优化的生产二进制
CGO_ENABLED=0 go build -ldflags="-s -w" -o app ./cmd/server/

# -s: 去除符号表
# -w: 去除 DWARF 调试信息
# CGO_ENABLED=0: 纯静态链接
```

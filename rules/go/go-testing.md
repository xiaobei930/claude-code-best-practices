---
description: "Go 测试规范：表驱动测试、基准测试、模糊测试"
paths:
  - "**/*.go"
---

# Go 测试规范 | Go Testing Rules

> 本文件扩展 [common/testing.md](../common/testing.md)，提供 Go 特定测试规范

## 表驱动测试

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name  string
        input string
        want  bool
    }{
        {"有效邮箱", "user@example.com", true},
        {"缺少@符号", "userexample.com", false},
        {"空字符串", "", false},
        {"缺少域名", "user@", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ValidateEmail(tt.input)
            if got != tt.want {
                t.Errorf("ValidateEmail(%q) = %v, want %v", tt.input, got, tt.want)
            }
        })
    }
}
```

## 测试辅助函数

```go
// ✅ 使用 t.Helper() 标记辅助函数，错误行号指向调用方
func assertNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatalf("期望无错误，得到: %v", err)
    }
}

// ✅ 使用 t.Cleanup 注册清理函数
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db, err := sql.Open("sqlite3", ":memory:")
    assertNoError(t, err)

    t.Cleanup(func() {
        db.Close()
    })
    return db
}
```

## testify 断言

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
    // assert — 失败后继续执行
    assert.Equal(t, expected, actual, "返回值不匹配")
    assert.NoError(t, err)
    assert.Contains(t, response.Body, "success")

    // require — 失败后立即终止（适合前置条件）
    require.NoError(t, err, "数据库连接不应失败")
}
```

## HTTP 测试

```go
import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestHealthEndpoint(t *testing.T) {
    handler := NewRouter()
    srv := httptest.NewServer(handler)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/health")
    require.NoError(t, err)
    defer resp.Body.Close()

    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

## Mock 接口

```go
// ✅ 使用接口实现 mock，无需第三方库
type mockUserStore struct {
    users map[int64]*User
}

func (m *mockUserStore) GetByID(ctx context.Context, id int64) (*User, error) {
    user, ok := m.users[id]
    if !ok {
        return nil, ErrNotFound
    }
    return user, nil
}

func TestGetUser(t *testing.T) {
    store := &mockUserStore{
        users: map[int64]*User{1: {ID: 1, Name: "测试用户"}},
    }
    svc := NewUserService(store)
    user, err := svc.GetUser(context.Background(), 1)
    require.NoError(t, err)
    assert.Equal(t, "测试用户", user.Name)
}
```

## 基准测试

```go
func BenchmarkParseJSON(b *testing.B) {
    data := loadTestData()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ParseJSON(data)
    }
}

// 带内存分配统计
func BenchmarkProcess(b *testing.B) {
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        Process(testInput)
    }
}
```

## 运行命令

```bash
go test ./...                         # 运行所有测试
go test -v ./internal/service/        # 详细输出指定包
go test -run TestCreateUser ./...     # 按名称过滤
go test -count=1 ./...                # 禁用缓存
go test -race ./...                   # 竞态检测
go test -bench=. ./...                # 运行基准测试
go test -cover ./...                  # 覆盖率报告
```

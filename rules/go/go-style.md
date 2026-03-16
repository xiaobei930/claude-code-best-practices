---
paths:
  - "**/*.go"
---

# Go 代码风格规则 | Go Style Rules

> 本文件扩展 [common/coding-standards.md](../common/coding-standards.md)，提供 Go 特定风格规范

## 格式化

- 使用 `gofmt` / `goimports` 自动格式化（零配置）
- 使用 `golangci-lint` 集成多种静态检查
- 在 CI 中运行 `gofmt -l .` 验证格式化

## 命名规范

- 包名: 小写单词，不用下划线或驼峰（`httputil` 而非 `http_util`）
- 导出标识符: `PascalCase`（`HandleRequest`）
- 未导出标识符: `camelCase`（`parseInput`）
- 接口: 单方法接口用方法名 + `er` 后缀（`Reader`、`Stringer`）
- 缩写词全大写: `HTTPClient`、`UserID`、`SQLDB`

## 包结构

```
project/
├── cmd/
│   └── server/
│       └── main.go         # 入口
├── internal/               # 不对外暴露
│   ├── handler/             # HTTP 处理
│   ├── service/             # 业务逻辑
│   └── repository/          # 数据访问
├── pkg/                    # 可复用的公共库
├── go.mod
└── go.sum
```

## 错误处理

```go
// ✅ 使用 fmt.Errorf %w 包装错误，保留错误链
func GetUser(id int64) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("查询用户 id=%d 失败: %w", id, err)
    }
    return user, nil
}

// ✅ 定义领域错误类型
var (
    ErrNotFound     = errors.New("资源未找到")
    ErrUnauthorized = errors.New("未授权")
)

// ✅ 调用方使用 errors.Is / errors.As 判断
if errors.Is(err, ErrNotFound) {
    http.Error(w, "未找到", http.StatusNotFound)
}
```

## 接口设计

```go
// ✅ 小接口，在消费方定义
type UserStore interface {
    GetByID(ctx context.Context, id int64) (*User, error)
}

// ❌ 大而全的接口（难以 mock、难以实现）
type UserService interface {
    GetByID(ctx context.Context, id int64) (*User, error)
    Create(ctx context.Context, u *User) error
    Update(ctx context.Context, u *User) error
    Delete(ctx context.Context, id int64) error
    List(ctx context.Context, opts ListOpts) ([]*User, error)
    // ... 更多方法
}
```

## 文档注释

```go
// Package httputil 提供 HTTP 请求处理的辅助函数
package httputil

// ParseRequest 解析 HTTP 请求体并验证参数
// 当请求体为空或格式错误时返回 ErrBadRequest
func ParseRequest(r *http.Request, dst interface{}) error {
    // ...
}
```

## 导出与未导出

- 仅导出外部需要的标识符，内部实现保持未导出
- 使用 `internal/` 目录防止包被外部项目引用
- 结构体字段非必要不导出，通过方法提供访问

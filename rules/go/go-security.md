---
description: "Go 安全规范：输入验证、并发安全、密钥管理"
paths:
  - "**/*.go"
---

# Go 安全规范 | Go Security Rules

> 本文件扩展 [common/security.md](../common/security.md)，提供 Go 特定安全规范

## 禁止操作

### 禁止拼接 SQL 语句

```go
// ❌ SQL 注入风险
query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)
db.Query(query)

// ✅ 使用参数化查询
db.Query("SELECT * FROM users WHERE name = $1", name)

// ✅ 使用 sqlx 命名参数
db.NamedQuery("SELECT * FROM users WHERE name = :name",
    map[string]interface{}{"name": name})
```

### 禁止拼接命令执行

```go
// ❌ 命令注入风险
exec.Command("sh", "-c", "ping "+userInput).Run()

// ✅ 直接传参，避免 shell 解析
exec.Command("ping", "-c", "4", host).Run()

// ✅ 验证输入格式
if !regexp.MustCompile(`^[\w.-]+$`).MatchString(host) {
    return fmt.Errorf("非法主机名: %s", host)
}
exec.Command("ping", "-c", "4", host).Run()
```

### 禁止路径遍历

```go
// ❌ 路径遍历风险
filePath := filepath.Join(uploadDir, userFilename)  // ../../etc/passwd

// ✅ 使用 filepath.Clean + 前缀检查
func safePath(base, userInput string) (string, error) {
    cleaned := filepath.Clean(filepath.Join(base, filepath.Base(userInput)))
    if !strings.HasPrefix(cleaned, filepath.Clean(base)) {
        return "", fmt.Errorf("非法路径: %s", userInput)
    }
    return cleaned, nil
}
```

---

## 必须遵守

### TLS 安全配置

```go
import "crypto/tls"

// ✅ 生产环境 TLS 配置
tlsConfig := &tls.Config{
    MinVersion:               tls.VersionTLS12,
    PreferServerCipherSuites: true,
    CipherSuites: []uint16{
        tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
        tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
    },
}

// ❌ 禁止跳过证书验证
tlsConfig := &tls.Config{InsecureSkipVerify: true}  // 中间人攻击风险
```

### 输入验证

```go
import "github.com/go-playground/validator/v10"

type CreateUserRequest struct {
    Name  string `json:"name" validate:"required,min=2,max=50"`
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=0,lte=150"`
}

var validate = validator.New()

func (r *CreateUserRequest) Validate() error {
    if err := validate.Struct(r); err != nil {
        return fmt.Errorf("参数验证失败: %w", err)
    }
    return nil
}
```

### 密钥管理

```go
// ❌ 硬编码密钥
const apiKey = "sk-xxxxxxxxxxxx"

// ✅ 从环境变量读取
apiKey := os.Getenv("API_KEY")
if apiKey == "" {
    log.Fatal("API_KEY 环境变量未设置")
}
```

---

## 推荐做法

### 静态安全扫描

```bash
# 使用 gosec 扫描安全问题
go install github.com/securego/gosec/v2/cmd/gosec@latest
gosec ./...

# 使用 govulncheck 检查依赖漏洞
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# 在 CI 中集成
gosec -fmt=json -out=security-report.json ./...
```

### 加密最佳实践

```go
import (
    "crypto/rand"
    "crypto/sha256"
    "golang.org/x/crypto/bcrypt"
)

// ✅ 密码哈希使用 bcrypt
func hashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}

// ✅ 生成安全随机 Token
func generateToken(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", fmt.Errorf("生成随机字节失败: %w", err)
    }
    return base64.URLEncoding.EncodeToString(bytes), nil
}

// ❌ 禁止使用 math/rand 生成安全相关数据
// math/rand 是伪随机，可被预测
```

### HTTP 安全中间件

```go
func SecurityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        next.ServeHTTP(w, r)
    })
}
```

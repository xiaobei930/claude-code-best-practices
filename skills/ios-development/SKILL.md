---
name: ios-development
description: "iOS/macOS native app development patterns: Swift concurrency, SwiftUI performance, Xcode configuration. Use when building iOS/macOS apps or optimizing Swift code."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# iOS/macOS 原生开发

## 概述

本技能涵盖 iOS/macOS 原生应用开发的核心知识：

- Swift 6.x 并发模式
- SwiftUI 性能优化
- UIKit 最佳实践
- Xcode 项目配置

## 相关文件

- [swift-concurrency.md](swift-concurrency.md) - Swift 并发专家指南
- [swiftui-performance.md](swiftui-performance.md) - SwiftUI 性能审计
- [xcode-tips.md](xcode-tips.md) - Xcode 配置技巧

## 快速参考

### Swift 版本要求

- **Swift 6.2+**: 完整并发安全
- **iOS 17+**: 最新 SwiftUI 特性
- **Xcode 16+**: 推荐开发环境

### 常用命令

```bash
# 构建项目
xcodebuild -scheme MyApp -sdk iphoneos build

# 运行测试
xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 15'

# 性能分析
xctrace record --template 'Time Profiler' --launch MyApp.app

# SwiftLint 检查
swiftlint lint --strict
```

### 项目结构推荐

```
MyApp/
├── App/
│   ├── MyApp.swift           # App 入口
│   └── ContentView.swift     # 主视图
├── Features/
│   ├── Auth/                 # 功能模块
│   │   ├── Views/
│   │   ├── ViewModels/
│   │   └── Models/
│   └── Home/
├── Core/
│   ├── Network/              # 网络层
│   ├── Storage/              # 存储层
│   └── Extensions/           # 扩展
├── Resources/
│   ├── Assets.xcassets
│   └── Localizable.strings
└── Tests/
```

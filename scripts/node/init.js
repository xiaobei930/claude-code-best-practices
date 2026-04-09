#!/usr/bin/env node
/**
 * Claude Code 项目初始化脚本
 *
 * Clone 模式用法: node scripts/node/init.js
 * Plugin 模式：在 Claude Code 中运行 /setup 命令
 * 跨平台支持（Windows/macOS/Linux）
 */

const fs = require("fs");
const path = require("path");
const { ensureDir, fileExists, writeFile, log } = require("../lib/utils");

// 颜色输出（支持跨平台）
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m"; // No Color

function success(msg) {
  console.log(`${GREEN}✅${NC} ${msg}`);
}

function skip(msg) {
  console.log(`${YELLOW}⏭️${NC} ${msg}`);
}

function info(msg) {
  console.log(`${BLUE}ℹ️${NC} ${msg}`);
}

// 获取脚本所在目录（插件根目录）
const SCRIPT_DIR = __dirname;
// 从 scripts/node/hooks/ 往上三级得到项目/插件根目录
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");

// 检测运行模式
function detectMode() {
  const pluginJsonPath = path.join(
    TEMPLATE_ROOT,
    ".claude-plugin",
    "plugin.json",
  );
  const localSettingsPath = path.join(
    process.cwd(),
    ".claude",
    "settings.json",
  );

  if (fileExists(pluginJsonPath) && !fileExists(localSettingsPath)) {
    return "plugin";
  }
  return "clone";
}

function copyIfNotExists(src, dest, description) {
  if (!fileExists(dest)) {
    if (fileExists(src)) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      success(`创建 ${description}`);
      return true;
    } else {
      info(`模板不存在: ${src}`);
      return false;
    }
  } else {
    skip(`${description} 已存在`);
    return false;
  }
}

function createFileIfNotExists(filePath, content, description) {
  if (!fileExists(filePath)) {
    ensureDir(path.dirname(filePath));
    writeFile(filePath, content);
    success(`创建 ${description}`);
  } else {
    skip(`${description} 已存在`);
  }
}

function main() {
  console.log("🚀 Claude Code 项目初始化");
  console.log("==========================");
  console.log("");

  const mode = detectMode();
  if (mode === "plugin") {
    console.log(`${YELLOW}📦 检测到 Plugin 模式${NC}`);
  } else {
    console.log(`${GREEN}📁 检测到 Clone 模式${NC}`);
  }
  console.log("");

  // 确定模板源目录
  const templateClaudeDir =
    mode === "plugin" ? path.join(TEMPLATE_ROOT, ".claude") : ".claude";

  // 1. 创建 .claude 目录
  ensureDir(".claude");

  // 2. 创建 settings.local.json
  copyIfNotExists(
    path.join(templateClaudeDir, "settings.local.json.example"),
    ".claude/settings.local.json",
    "settings.local.json",
  );

  // 3. 创建 Hookify 规则文件（仅 Clone 模式，Plugin 模式由 hooks.json 提供安全功能）
  if (mode === "clone" && fileExists(templateClaudeDir)) {
    const hookifyExamples = fs
      .readdirSync(templateClaudeDir)
      .filter((f) => f.match(/^hookify\..*\.local\.md\.example$/));
    for (const example of hookifyExamples) {
      const target = example.replace(".example", "");
      copyIfNotExists(
        path.join(templateClaudeDir, example),
        path.join(".claude", target),
        target,
      );
    }
  } else if (mode === "plugin") {
    info("Plugin 模式下安全功能由 hooks.json 提供");
  }

  // 3. 创建必要目录
  const dirs = [
    ".claude/screenshots",
    ".claude/logs",
    "memory-bank",
    "docs/requirements",
    "docs/designs",
    "docs/tasks",
  ];
  for (const dir of dirs) {
    ensureDir(dir);
  }
  success("创建目录结构");

  // 4. 创建 Memory Bank 文件
  createFileIfNotExists(
    "memory-bank/progress.md",
    `# 项目进度

## 当前状态
- **阶段**: 初始化
- **进度**: 0%

## 待办任务
- [ ] 完成项目初始化
- [ ] 定义技术栈
- [ ] 创建第一个需求

## 已完成
（暂无）

## 阻塞项
（暂无）
`,
    "memory-bank/progress.md",
  );

  createFileIfNotExists(
    "memory-bank/architecture.md",
    `# 系统架构

## 概述
（待定义）

## 模块划分
（待定义）

## 数据流
（待定义）
`,
    "memory-bank/architecture.md",
  );

  createFileIfNotExists(
    "memory-bank/tech-stack.md",
    `# 技术栈

## 后端
- **语言**: （待定义）
- **框架**: （待定义）
- **数据库**: （待定义）

## 前端
- **框架**: （待定义）
- **UI 库**: （待定义）

## 工具链
- **包管理**: （待定义）
- **构建工具**: （待定义）
- **测试框架**: （待定义）
`,
    "memory-bank/tech-stack.md",
  );

  console.log("");
  console.log("==========================");
  success("初始化完成！");
  console.log("");
  console.log("下一步：");
  console.log("  1. 编辑 CLAUDE.md 填写项目信息");
  console.log("  2. 编辑 memory-bank/tech-stack.md 定义技术栈");
  console.log("  3. 运行 /pm 开始第一个需求");
}

try {
  main();
} catch (err) {
  console.error("[Init] Error:", err.message);
  process.exit(1);
}

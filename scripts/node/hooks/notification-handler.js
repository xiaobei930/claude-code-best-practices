#!/usr/bin/env node
/**
 * Notification Handler: 通知事件处理
 *
 * 处理 Claude Code 产生的通知事件：
 * 1. 记录通知到日志
 * 2. 输出关键通知信息
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: Notification
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`notification-handler.js - 通知处理

用途: Notification hook，记录和处理 Claude Code 通知事件
触发: 收到通知时`);
  process.exit(0);
}

const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("notification-handler")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const message = input.message || input.title || "";
    const level = input.level || "info";

    // 只输出重要通知（warning/error）
    if (level === "warning" || level === "error") {
      log(`[Notification] [${level.toUpperCase()}] ${message}`);
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

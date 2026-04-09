#!/usr/bin/env node
/**
 * Permission Request: 权限请求记录
 *
 * 当工具调用触发权限弹窗时记录请求信息，
 * 帮助用户了解哪些操作请求了提升权限。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PermissionRequest
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`permission-request.js - 权限请求记录

用途: PermissionRequest hook，记录工具权限请求信息
触发: 工具调用触发权限弹窗时`);
  process.exit(0);
}

const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("permission-request")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const toolName = input.tool_name || "unknown";
    const toolInput = input.tool_input || {};

    // 提取关键信息用于日志
    const detail = toolInput.command || toolInput.file_path || "";
    const shortDetail =
      detail.length > 60 ? detail.slice(0, 57) + "..." : detail;

    log(
      `[PermissionRequest] 工具 "${toolName}" 请求权限${shortDetail ? `: ${shortDetail}` : ""}`,
    );

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

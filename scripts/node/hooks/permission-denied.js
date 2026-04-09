#!/usr/bin/env node
/**
 * Permission Denied: 权限拒绝追踪
 *
 * 当工具调用被用户或自动模式拒绝时，
 * 记录拒绝事件到 observations.jsonl 供 /learn 消费。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PermissionDenied
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`permission-denied.js - 权限拒绝追踪

用途: PermissionDenied hook，记录被拒绝的权限请求
触发: 工具调用权限被拒绝时`);
  process.exit(0);
}

const path = require("path");
const {
  readStdinJson,
  log,
  shouldRunInProfile,
  getPluginDataDir,
  appendFile,
  getDateTimeString,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("permission-denied")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const toolName = input.tool_name || "unknown";
    const toolInput = input.tool_input || {};
    const reason = input.reason || "";

    log(
      `[PermissionDenied] 工具 "${toolName}" 权限被拒绝${reason ? `: ${reason}` : ""}`,
    );

    // 记录到 observations.jsonl
    const observation = {
      timestamp: getDateTimeString(),
      type: "permission_denied",
      pattern_id: `denied_${toolName}`,
      tool_name: toolName,
      detail: toolInput.command || toolInput.file_path || "",
      reason,
    };

    const dataDir = getPluginDataDir();
    const obsFile = path.join(dataDir, "observations.jsonl");
    appendFile(obsFile, JSON.stringify(observation) + "\n");

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

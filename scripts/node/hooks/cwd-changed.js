#!/usr/bin/env node
/**
 * CWD Changed: 工作目录变更记录
 *
 * 当工作目录发生变化时记录日志，
 * 帮助追踪会话中的目录切换。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: CwdChanged
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`cwd-changed.js - 工作目录变更记录

用途: CwdChanged hook，记录工作目录切换
触发: 工作目录发生变化时`);
  process.exit(0);
}

const path = require("path");
const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("cwd-changed")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const oldCwd = input.old_cwd || input.previous || "";
    const newCwd = input.new_cwd || input.current || process.cwd();
    const dirName = path.basename(newCwd);

    log(
      `[CwdChanged] 工作目录切换到 "${dirName}"${oldCwd ? ` (从 ${path.basename(oldCwd)})` : ""}`,
    );

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

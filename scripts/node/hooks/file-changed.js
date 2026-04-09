#!/usr/bin/env node
/**
 * File Changed: 外部文件变更检测
 *
 * 当监控的文件在磁盘上被外部修改时提醒用户，
 * 避免 Claude 使用过期的文件内容。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: FileChanged
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`file-changed.js - 外部文件变更检测

用途: FileChanged hook，检测外部文件修改并提醒
触发: 监控的文件在磁盘上被修改时`);
  process.exit(0);
}

const path = require("path");
const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("file-changed")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const filePath = input.file_path || input.path || "";
    const fileName = filePath ? path.basename(filePath) : "unknown";

    // 对关键文件给出更明显的提醒
    const criticalPatterns = [
      /package\.json$/,
      /tsconfig.*\.json$/,
      /\.env/,
      /CLAUDE\.md$/,
      /progress\.md$/,
    ];

    const isCritical = criticalPatterns.some((p) => p.test(filePath));
    const prefix = isCritical ? "⚠️ " : "";

    log(
      `${prefix}[FileChanged] 文件 "${fileName}" 已被外部修改${isCritical ? "（关键文件，建议重新读取）" : ""}`,
    );

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

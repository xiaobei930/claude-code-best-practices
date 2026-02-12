#!/usr/bin/env node
/**
 * Session Start: 会话启动时加载上次上下文
 *
 * 检查 memory-bank 中的进度文件，通知有可用的上下文可加载。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: SessionStart
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

const path = require("path");
const { readFile, fileExists, getMemoryBankDir, log } = require("../lib/utils");

const PROJECT_ROOT = process.cwd();

/**
 * 主函数
 */
async function main() {
  try {
    const memoryBankDir = getMemoryBankDir(PROJECT_ROOT);
    const progressPath = path.join(memoryBankDir, "progress.md");

    if (!fileExists(progressPath)) {
      process.exit(0);
    }

    const content = readFile(progressPath);
    if (!content) {
      process.exit(0);
    }

    // 检查最后修改时间
    const fs = require("fs");
    const stats = fs.statSync(progressPath);
    const lastModified = stats.mtime
      .toISOString()
      .replace("T", " ")
      .slice(0, 16);
    log(`[SessionStart] progress.md 最后更新: ${lastModified}`);

    // 检查未完成任务数
    const pendingMatches = content.match(/- \[ \]/g);
    const pendingCount = pendingMatches ? pendingMatches.length : 0;
    if (pendingCount > 0) {
      log(`[SessionStart] 发现 ${pendingCount} 个待完成任务`);
    }

    process.exit(0);
  } catch {
    // 静默失败
    process.exit(0);
  }
}

main();

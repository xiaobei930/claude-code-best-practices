#!/usr/bin/env node
/**
 * Post Compact: 上下文压缩后恢复关键状态
 *
 * 在上下文压缩完成后恢复工作状态：
 * 1. 读取 PreCompact 保存的状态文件
 * 2. 输出恢复信息（分支、未完成任务、修改文件）
 * 3. 提醒阅读 progress.md 恢复上下文
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PostCompact
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 恢复完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`post-compact.js - 压缩后恢复

用途: PostCompact hook，读取 PreCompact 保存的状态并输出恢复信息
触发: 上下文压缩完成后`);
  process.exit(0);
}

const path = require("path");
const {
  getMemoryBankDir,
  readJsonFile,
  fileExists,
  log, shouldRunInProfile} = require("../lib/utils");


// Hook Profile 检查
if (!shouldRunInProfile('post-compact')) {
  process.exit(0);
}

async function main() {
  const memoryBank = getMemoryBankDir();
  const statePath = path.join(memoryBank, ".pre-compact-state.json");

  if (!fileExists(statePath)) {
    log("[PostCompact] 未找到压缩前状态文件，跳过恢复");
    process.exit(0);
  }

  const state = readJsonFile(statePath);
  if (!state) {
    log("[PostCompact] 状态文件解析失败");
    process.exit(0);
  }

  // 输出恢复信息
  log("[PostCompact] ===== 上下文已压缩，恢复工作状态 =====");

  if (state.git && state.git.branch) {
    log(`  分支: ${state.git.branch}`);
    if (state.git.uncommittedChanges > 0) {
      log(`  未提交: ${state.git.uncommittedChanges} 个文件`);
    }
  }

  if (state.tasks) {
    log(
      `  任务: ${state.tasks.completed || 0} 已完成, ${state.tasks.pending || 0} 待完成`,
    );

    if (state.tasks.list && state.tasks.list.length > 0) {
      log("  待办事项:");
      state.tasks.list.slice(0, 5).forEach((task) => {
        log(`    ${task}`);
      });
    }
  }

  if (state.modifiedFiles && state.modifiedFiles.length > 0) {
    log(`  最近修改: ${state.modifiedFiles.slice(0, 5).join(", ")}`);
  }

  log("[PostCompact] 建议: 请先阅读 memory-bank/progress.md 恢复完整上下文");
  log("[PostCompact] ===== 恢复信息输出完毕 =====");

  process.exit(0);
}

main().catch((err) => {
  console.error("[PostCompact] Error:", err.message);
  process.exit(0);
});

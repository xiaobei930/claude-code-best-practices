#!/usr/bin/env node
/**
 * Suggest Compact: 策略性压缩提醒
 *
 * 在工具调用达到阈值时提醒用户考虑压缩上下文。
 * 这是对 Claude Code 官方 auto-compact bug 的 workaround。
 *
 * 背景：
 * - 官方 auto-compact 设计在 95% 时触发，但有 bug 可能失败
 * - 当上下文超过 ~85% 时，/compact 命令也可能失败
 * - 因此需要在更早的时机（基于工具调用次数估算）提醒用户
 *
 * 触发时机: PostToolUse (每次工具调用后)
 * 匹配工具: * (所有工具)
 *
 * 配置:
 * - COMPACT_THRESHOLD: 首次提醒的工具调用数 (默认: 40)
 * - COMPACT_INTERVAL: 后续提醒间隔 (默认: 20)
 *
 * Exit codes:
 * - 0: 正常（不阻止操作）
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`suggest-compact.js - 压缩提醒

用途: PostToolUse hook，工具调用达到阈值时提醒压缩上下文
触发: 所有工具调用后（计数器检测）`);
  process.exit(0);
}

const path = require("path");
const fs = require("fs");
const {
  getTempDir,
  getSessionId,
  getSessionIdShort,
  getMemoryBankDir,
  fileExists,
  readFile,
  writeFile,
  log, shouldRunInProfile} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile('suggest-compact')) {
  process.exit(0);
}

// ==================== 回滚开关 ====================
const ENABLE_OPERATION_SUPPRESSION = true; // F6a: false → 不抑制 compact

// 配置
const THRESHOLD = parseInt(process.env.COMPACT_THRESHOLD || "40", 10);
const INTERVAL = parseInt(process.env.COMPACT_INTERVAL || "20", 10);

/**
 * 获取计数器文件路径（按会话隔离）
 */
function getCounterFilePath() {
  const sessionId = getSessionId("default");
  return path.join(getTempDir(), `claude-tool-count-${sessionId}.txt`);
}

/**
 * 读取当前计数
 */
function readCount() {
  const counterFile = getCounterFilePath();
  if (!fileExists(counterFile)) {
    return 0;
  }
  const content = readFile(counterFile);
  return parseInt(content, 10) || 0;
}

/**
 * 写入计数
 */
function writeCount(count) {
  const counterFile = getCounterFilePath();
  writeFile(counterFile, String(count));
}

/**
 * 检测管线阶段切换（补充建议，不替换计数器逻辑）
 * 读取 progress.md 最近的角色标记，与上次记录的角色对比
 */
function detectPhaseSwitch() {
  try {
    // 查找 progress.md（优先 memory-bank/，其次项目根目录）
    const candidates = [
      path.join(process.cwd(), "memory-bank", "progress.md"),
      path.join(process.cwd(), "progress.md"),
    ];

    let progressContent = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        progressContent = fs.readFileSync(p, "utf8");
        break;
      }
    }

    if (!progressContent) return null;

    // 检测最近的角色标记（PM/Lead/Dev/QA/Designer）
    const rolePattern = /\b(PM|Lead|Dev|QA|Designer)\b/gi;
    const matches = progressContent.match(rolePattern);
    if (!matches || matches.length === 0) return null;

    const currentRole = matches[matches.length - 1].toLowerCase();

    // 读取上次记录的角色
    const sessionId = getSessionId("default");
    const phaseFile = path.join(getTempDir(), `claude-phase-${sessionId}.txt`);

    let lastRole = null;
    if (fs.existsSync(phaseFile)) {
      lastRole = fs.readFileSync(phaseFile, "utf8").trim().toLowerCase();
    }

    // 记录当前角色
    fs.writeFileSync(phaseFile, currentRole);

    // 如果角色发生了切换，返回切换信息
    if (lastRole && lastRole !== currentRole) {
      return { from: lastRole, to: currentRole };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 主函数
 */
/**
 * F6a: 检测调试循环时抑制 compact 建议
 * 读取 observations.jsonl 中当前 session 的 fix_retry 模式
 */
function shouldSuppressCompact() {
  if (!ENABLE_OPERATION_SUPPRESSION) return false;

  const shortId = getSessionIdShort("default");
  const mbDir = getMemoryBankDir();
  const obsFile = path.join(mbDir, "observations.jsonl");
  if (!fs.existsSync(obsFile)) return false;

  try {
    const lines = fs.readFileSync(obsFile, "utf8").split("\n").filter(Boolean);
    const sessionObs = lines.filter((l) => {
      try {
        return JSON.parse(l).sessionId === shortId;
      } catch {
        return false;
      }
    });
    return sessionObs.some((l) => {
      try {
        return JSON.parse(l).pattern === "fix_retry";
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}


function main() {
  // 增加计数
  const count = readCount() + 1;
  writeCount(count);

  // F6a: 调试循环中抑制 compact 建议
  if (shouldSuppressCompact()) {
    process.exit(0);
  }

  // 首次达到阈值时提醒
  if (count === THRESHOLD) {
    log(
      `[CompactReminder] ⚠️ 已进行 ${THRESHOLD} 次工具调用，建议在任务完成时执行上下文压缩`,
    );
    log(`[CompactReminder] 💡 /iterate 模式: 将在下一个任务完成点自动保存状态`);
  }

  // 超过阈值后定期提醒
  if (count > THRESHOLD && (count - THRESHOLD) % INTERVAL === 0) {
    log(`[CompactReminder] ⚠️ 已进行 ${count} 次工具调用，上下文压力较大`);
    log(`[CompactReminder] 💡 /iterate 模式: 请在当前任务完成后触发自动压缩`);
  }

  // 高频提醒（可能接近上下文极限）
  if (count >= THRESHOLD * 2) {
    if ((count - THRESHOLD * 2) % 10 === 0) {
      log(`[CompactReminder] 🔴 已进行 ${count} 次工具调用，上下文接近极限！`);
      log(
        `[CompactReminder] 🔴 立即保存状态并执行压缩（/cc-best:checkpoint → /clear → /cc-best:catchup）`,
      );
    }
  }

  // 阶段感知：检测管线角色切换
  const phaseSwitch = detectPhaseSwitch();
  if (phaseSwitch) {
    log(
      `[CompactReminder] 🔄 检测到阶段切换: ${phaseSwitch.from} → ${phaseSwitch.to}`,
    );
    log(`[CompactReminder] 💡 阶段切换是压缩的好时机，建议先保存进度再压缩`);
  }

  process.exit(0);
}

try {
  main();
} catch {
  // Hook 应静默失败，不阻止用户操作
  process.exit(0);
}

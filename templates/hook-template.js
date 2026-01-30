#!/usr/bin/env node
/**
 * [Hook 名称]: [一句话功能描述]
 *
 * [详细功能说明，包括触发时机和处理逻辑]
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: [PreToolUse|PostToolUse|SessionStart|SessionEnd|PreCompact]
 * 匹配工具: [Bash|Write|Edit|*]
 *
 * Exit codes:
 * - 0: 正常通过，继续执行
 * - 2: 阻止执行（仅 PreToolUse 有效）
 */

const fs = require("fs");
const path = require("path");
const { readStdinJson, log } = require("../lib/utils");

// ============================================================================
// 常量定义
// ============================================================================

const HOOK_NAME = "[HookName]";

// [配置常量，如文件列表、正则表达式等]
const CONFIG = {
  // 示例配置项
  enabled: true,
  patterns: [],
  excludes: [],
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * [函数描述]
 * @param {string} param - [参数描述]
 * @returns {boolean} [返回值描述]
 */
function helperFunction(param) {
  // 实现逻辑
  return true;
}

// ============================================================================
// 主逻辑
// ============================================================================

/**
 * 主函数
 */
async function main() {
  let input;

  // 读取 stdin 输入
  try {
    input = await readStdinJson();
  } catch {
    // 无输入或解析失败，静默退出
    process.exit(0);
  }

  // 提取工具调用信息
  const toolName = input?.tool_name;
  const toolInput = input?.tool_input || {};

  // 验证输入
  if (!toolName) {
    process.exit(0);
  }

  // [主要处理逻辑]
  try {
    // 示例：检查特定条件
    const shouldBlock = false; // 替换为实际判断逻辑

    if (shouldBlock) {
      // 阻止执行并输出原因
      log(`[${HOOK_NAME}] ⚠️ 操作被阻止: [原因描述]`);
      process.exit(2);
    }

    // 正常通过
    // log(`[${HOOK_NAME}] ✅ 检查通过`);  // 可选：成功日志
    process.exit(0);
  } catch (err) {
    // 错误处理：记录错误但不阻塞
    log(`[${HOOK_NAME}] 错误: ${err.message}`);
    process.exit(0);
  }
}

// ============================================================================
// 入口
// ============================================================================

main().catch((err) => {
  log(`[${HOOK_NAME}] 未捕获错误: ${err.message}`);
  process.exit(0);
});

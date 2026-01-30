#!/usr/bin/env node
/**
 * Check Console Log: 检查 console 语句
 *
 * 在编辑 JS/TS 文件后检查是否有 console 语句，
 * 在生产分支上会发出更严重的警告。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PostToolUse
 * 匹配工具: Edit, Write
 *
 * Exit codes:
 * - 0: 检查完成（不阻止执行）
 */

const fs = require("fs");
const path = require("path");
const { readStdinJson, log, getGitBranch } = require("../lib/utils");

// 生产分支列表
const PROTECTED_BRANCHES = ["main", "master", "production", "prod", "release"];

// 检测的 console 方法
const CONSOLE_METHODS = ["log", "warn", "error", "debug", "info", "trace"];

async function main() {
  let input;
  try {
    input = await readStdinJson();
  } catch {
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path || "";

  // 只检查 JS/TS 文件
  if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(filePath)) {
    process.exit(0);
  }

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    process.exit(0);
  }

  // 读取文件内容
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    process.exit(0);
  }

  // 检查当前分支
  const branch = getGitBranch() || "";
  const isProtectedBranch = PROTECTED_BRANCHES.includes(branch);

  // 构建正则：匹配 console.log/warn/error/debug/info/trace
  const consolePattern = new RegExp(
    `console\\.(${CONSOLE_METHODS.join("|")})`,
    "g",
  );

  // 检查 console 语句
  const consoleLogs = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 跳过注释行
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }

    // 跳过在字符串中的 console（简单检测）
    if (trimmed.includes('"console.') || trimmed.includes("'console.")) {
      continue;
    }

    if (consolePattern.test(line)) {
      const lineNum = i + 1;
      const preview = trimmed.slice(0, 60);
      consoleLogs.push({ line: lineNum, content: preview });
    }
    // 重置正则状态
    consolePattern.lastIndex = 0;
  }

  if (consoleLogs.length > 0) {
    const fileName = path.basename(filePath);

    if (isProtectedBranch) {
      // 生产分支：严重警告
      log(`⚠️  [Hook] 生产分支警告: 在 '${branch}' 分支发现 console 语句`);
      log(`   文件: ${fileName}`);
      for (const item of consoleLogs.slice(0, 5)) {
        log(`   L${item.line}: ${item.content}...`);
      }
      if (consoleLogs.length > 5) {
        log(`   ... 还有 ${consoleLogs.length - 5} 处`);
      }
      log(`   建议: 合并前移除调试语句，或使用 logger 替代`);
    } else {
      // 非生产分支：普通提示
      log(
        `[Hook] 提示: ${fileName} 中有 ${consoleLogs.length} 处 console 语句`,
      );
      // 只显示前 3 个
      for (const item of consoleLogs.slice(0, 3)) {
        log(`  L${item.line}: ${item.content}`);
      }
      if (consoleLogs.length > 3) {
        log(`  ... 还有 ${consoleLogs.length - 3} 处`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[CheckConsoleLog] Error:", err.message);
  process.exit(0);
});

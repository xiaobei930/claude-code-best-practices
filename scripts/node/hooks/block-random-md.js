#!/usr/bin/env node
/**
 * Block Random MD: 阻止随机创建 .md 文件
 *
 * 在 PreToolUse Write hook 中运行，防止意外创建不必要的 markdown 文件。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PreToolUse
 * 匹配工具: Write
 *
 * Exit codes:
 * - 0: 允许操作
 * - 2: 阻止操作
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`block-random-md.js - Markdown 保护

用途: PreToolUse hook，阻止在根目录创建随机 .md 文件
触发: Write 工具调用前（检测根目录 .md 文件创建）`);
  process.exit(0);
}

const path = require("path");
const { readStdinJson, log } = require("../lib/utils");

// 允许创建的 markdown 文件模式
const ALLOWED_MD_PATTERNS = [
  // memory-bank 目录下的文档
  "memory-bank/",
  // .claude 配置目录
  ".claude/",
  // 标准文档文件
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE.md",
  "CODE_OF_CONDUCT.md",
  // 文档目录
  "docs/",
  "documentation/",
  // API 文档
  "api-docs/",
  // 规范文件
  "specs/",
  "spec/",
];

// 必须阻止的模式
const BLOCKED_MD_NAMES = [
  "temp.md",
  "tmp.md",
  "test.md",
  "notes.md",
  "scratch.md",
  "untitled.md",
];

/**
 * 检查文件路径是否被允许
 */
function isAllowedPath(filePath) {
  // 标准化路径
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();

  // 不是 markdown 文件，允许
  if (!normalized.endsWith(".md")) {
    return true;
  }

  // 检查是否匹配允许的模式
  for (const pattern of ALLOWED_MD_PATTERNS) {
    if (pattern.endsWith("/")) {
      // 目录模式
      if (normalized.includes(pattern.toLowerCase())) {
        return true;
      }
    } else {
      // 文件名模式
      if (normalized.endsWith(pattern.toLowerCase())) {
        return true;
      }
    }
  }

  // 检查是否是被阻止的文件名
  const filename = path.basename(normalized);
  for (const blocked of BLOCKED_MD_NAMES) {
    if (filename === blocked.toLowerCase()) {
      return false;
    }
  }

  // 默认阻止根目录或一级目录下的随机 md 文件
  const parts = normalized.split("/").filter((p) => p);
  if (parts.length <= 2) {
    log(`[BlockMD] 阻止: 不允许在项目根目录创建随机 .md 文件: ${filePath}`);
    log(`[BlockMD] 提示: 文档应放在 docs/, memory-bank/, 或 .claude/ 目录下`);
    return false;
  }

  return true;
}

/**
 * 主函数
 */
async function main() {
  try {
    const input = await readStdinJson();
    const filePath = (input.tool_input || {}).file_path || "";

    if (!filePath) {
      process.exit(0);
    }

    if (!isAllowedPath(filePath)) {
      process.exit(2); // Exit code 2 = 阻止执行
    }

    process.exit(0);
  } catch {
    // 静默失败，不阻止操作
    process.exit(0);
  }
}

main();

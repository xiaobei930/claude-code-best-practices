#!/usr/bin/env node
/**
 * Instructions Loaded: 指令加载验证
 *
 * 当 CLAUDE.md 或 .claude/rules/*.md 文件被加载时，
 * 验证加载状态并注入插件版本信息。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: InstructionsLoaded
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`instructions-loaded.js - 指令加载验证

用途: InstructionsLoaded hook，验证指令加载并注入插件信息
触发: CLAUDE.md 或 rules 文件加载时`);
  process.exit(0);
}

const path = require("path");
const {
  readStdinJson,
  log,
  shouldRunInProfile,
  readJsonFile,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("instructions-loaded")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    // 尝试读取插件版本
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "";
    let version = "unknown";
    if (pluginRoot) {
      const pluginJson = readJsonFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      );
      if (pluginJson && pluginJson.version) {
        version = pluginJson.version;
      }
    }

    const filesCount = input.files_count || input.count || "";
    const detail = filesCount ? ` (${filesCount} 个文件)` : "";

    log(`[InstructionsLoaded] cc-best v${version} 指令已加载${detail}`);

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

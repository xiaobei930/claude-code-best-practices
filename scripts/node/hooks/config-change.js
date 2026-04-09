#!/usr/bin/env node
/**
 * Config Change: 配置文件变更检测
 *
 * 当配置文件在会话中被修改时提醒用户，
 * 某些配置变更可能需要重新加载插件或重启会话。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: ConfigChange
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`config-change.js - 配置文件变更检测

用途: ConfigChange hook，检测配置变更并提醒
触发: 配置文件在会话中被修改时`);
  process.exit(0);
}

const path = require("path");
const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("config-change")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const configFile = input.file_path || input.path || "";
    const fileName = configFile ? path.basename(configFile) : "unknown";

    // 判断是否需要 reload
    const needsReload =
      /settings\.json|hooks\.json|plugin\.json|\.mcp\.json/.test(fileName);

    log(
      `[ConfigChange] 配置 "${fileName}" 已变更${needsReload ? "（建议执行 /reload-plugins 重新加载）" : ""}`,
    );

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

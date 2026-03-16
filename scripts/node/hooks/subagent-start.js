#!/usr/bin/env node
/**
 * Subagent Start: 子代理启动时追踪
 *
 * 在子代理（Agent）启动时记录启动信息，
 * 与 SubagentStop 配对，完整追踪 Agent 生命周期。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: SubagentStart
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`subagent-start.js - 子代理启动追踪

用途: SubagentStart hook，记录子代理启动信息
触发: 子代理启动时`);
  process.exit(0);
}

const { readStdinJson, log, shouldRunInProfile } = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("subagent-start")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const agentName = input.agent_name || input.subagent_type || "unknown";
    const agentId = input.agent_id || "";

    log(
      `[AgentTracker] Agent "${agentName}" 启动${agentId ? ` (${agentId.slice(-8)})` : ""}`,
    );

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

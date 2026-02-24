#!/usr/bin/env node
/**
 * Long Running Warning: 长时间运行命令提醒
 *
 * 检测 dev server、watch 等可能长时间运行的命令：
 * 1. 警告长时间运行命令
 * 2. 在 Linux/macOS/WSL 环境下提醒使用 tmux
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PreToolUse
 * 匹配工具: Bash
 *
 * Exit codes:
 * - 0: 检测完成（不阻止执行）
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`long-running-warning.js - 长运行预警

用途: PreToolUse hook，检测 dev server、watch 等长时间运行命令
触发: Bash 工具调用前（检测 npm run dev、watch 等）`);
  process.exit(0);
}

const { readStdinJson, log } = require("../lib/utils");

// 平台检测
const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isWSL = !!process.env.WSL_DISTRO_NAME;
const inTmux = !!process.env.TMUX;

// tmux 可用的环境（非纯 Windows 或在 WSL 中）
const tmuxAvailable = isMacOS || isLinux || isWSL;

// 长时间运行命令模式
const LONG_RUNNING_PATTERNS = [
  /npm\s+run\s+(dev|start|watch)/i,
  /yarn\s+(dev|start|watch)/i,
  /pnpm\s+(dev|start|watch)/i,
  /bun\s+(run\s+)?(dev|start|watch)/i,
  /nodemon/i,
  /ts-node-dev/i,
  /vite(\s|$)/i,
  /next\s+dev/i,
  /nuxt\s+dev/i,
  /webpack.*--watch/i,
  /tsc.*--watch/i,
  /jest.*--watch/i,
  /vitest.*--watch/i,
  /python.*manage\.py\s+runserver/i,
  /flask\s+run/i,
  /uvicorn.*--reload/i,
  /cargo\s+watch/i,
  /go\s+run.*--watch/i,
  /npm\s+start/i,
  /serve\s+-/i,
  /live-server/i,
  /browser-sync/i,
];

async function main() {
  let input;
  try {
    input = await readStdinJson();
  } catch {
    process.exit(0);
  }

  const command = input?.tool_input?.command || "";

  if (!command) {
    process.exit(0);
  }

  // 检查是否匹配长时间运行模式
  for (const pattern of LONG_RUNNING_PATTERNS) {
    if (pattern.test(command)) {
      log("");
      log("[LongRunning] 检测到长时间运行命令 Long-running command detected:");
      log("  " + command.slice(0, 60) + (command.length > 60 ? "..." : ""));
      log("");
      log("[LongRunning] 建议 Suggestions:");
      log("  - 使用 run_in_background: true 在后台运行");
      log("    Use run_in_background: true to run in background");
      log("  - 或在单独的终端窗口中手动启动");
      log("    Or start manually in a separate terminal");

      // tmux 提醒（仅在支持的环境且不在 tmux 中时）
      if (tmuxAvailable && !inTmux) {
        log("");
        log("[LongRunning] tmux 建议 tmux suggestion:");
        log("  考虑使用 tmux 保持会话持久化：");
        log("  Consider using tmux for session persistence:");
        log("");
        log("    tmux new -s dev        # 创建新会话 Create new session");
        log("    tmux attach -t dev     # 连接会话 Attach to session");
        log("    Ctrl+B, D              # 分离会话 Detach from session");
      }

      log("");
      // 不阻止，只是警告
      break;
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[LongRunning] Error:", err.message);
  process.exit(0);
});

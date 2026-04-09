#!/usr/bin/env node
/**
 * Task Completed: 任务完成追踪
 *
 * 当任务被标记为完成时记录事件，
 * 配合 SubagentStart/Stop 实现完整的任务生命周期追踪。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: TaskCompleted
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`task-completed.js - 任务完成追踪

用途: TaskCompleted hook，记录任务完成事件
触发: 任务被标记为完成时`);
  process.exit(0);
}

const path = require("path");
const {
  readStdinJson,
  log,
  shouldRunInProfile,
  getPluginDataDir,
  appendFile,
  getDateTimeString,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("task-completed")) {
  process.exit(0);
}

async function main() {
  try {
    const input = await readStdinJson();

    const taskId = input.task_id || input.id || "";
    const subject = input.subject || input.title || "";

    log(
      `[TaskCompleted] 任务完成${taskId ? ` #${taskId}` : ""}${subject ? `: ${subject}` : ""}`,
    );

    // 记录到 observations.jsonl
    const observation = {
      timestamp: getDateTimeString(),
      type: "task_completed",
      pattern_id: "task_lifecycle",
      task_id: taskId,
      subject,
    };

    const dataDir = getPluginDataDir();
    const obsFile = path.join(dataDir, "observations.jsonl");
    appendFile(obsFile, JSON.stringify(observation) + "\n");

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();

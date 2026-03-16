#!/usr/bin/env node
/**
 * Evaluate Session: 会话结束自动摘要 + 学习聚合
 *
 * F10: 解析 transcript → 写入 session 摘要文件 → 清理过期
 * F4:  读取 observations.jsonl → pattern_id 聚合 → 高置信度候选标记
 *
 * 触发时机: SessionEnd
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 评估完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`evaluate-session.js - 会话评估 + 摘要持久化

用途: SessionEnd hook，会话结束时：
  1. 解析 transcript 提取工具调用统计
  2. 写入 session 摘要到 memory-bank/sessions/
  3. 聚合 observations.jsonl 中的 pattern_id
  4. 清理过期 session 文件（>7 天）

触发: 会话结束时`);
  process.exit(0);
}

const fs = require("fs");
const path = require("path");
const {
  readStdinJson,
  log,
  getSessionIdShort,
  getMemoryBankDir,
  ensureDir,
  readFile,
  writeFile,
  shouldRunInProfile,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("evaluate-session")) {
  process.exit(0);
}

// ==================== 回滚开关 ====================
const ENABLE_DYNAMIC_CONFIDENCE = true; // F4: false → 跳过 pattern 聚合

// ==================== 配置 ====================
const MIN_SESSION_LENGTH = 10; // 最小会话消息数
const SESSION_MAX_AGE_DAYS = 7; // session 文件保留天数
const SESSION_MAX_SIZE = 2048; // 单个 session 文件最大字节数
const LEARNED_DIR = ".claude/learned";

// 置信度阶梯（F4 动态置信度）
const CONFIDENCE_LEVELS = [
  { min: 1, max: 1, value: 0.3 },
  { min: 2, max: 3, value: 0.5 },
  { min: 4, max: 6, value: 0.7 },
  { min: 7, max: Infinity, value: 0.9 },
];

// ==================== Transcript 解析 (F10) ====================

/**
 * 解析 transcript JSONL，提取会话统计
 *
 * transcript 结构（Phase -1 验证）:
 * - type=assistant 行的 message.content[] 含 tool_use（name, input, id）
 * - type=user 行的 message.content[] 含 tool_result（tool_use_id, content, is_error）
 * - Edit/Write/Read 的 input 有 file_path 字段
 * - Bash 的 result.content 以 "Exit code N\n" 开头，is_error=true 表示出错
 */
function parseTranscript(transcriptPath) {
  const stats = {
    messageCount: 0,
    userCount: 0,
    assistantCount: 0,
    toolCallCount: 0,
    errorCount: 0,
    hasCorrections: false,
    modifiedFiles: {}, // file -> { tool, count }
  };

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return stats;
  }

  try {
    const content = fs.readFileSync(transcriptPath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === "user") {
          stats.messageCount++;
          stats.userCount++;

          // 检测用户纠正
          if (entry.message && entry.message.content) {
            const text =
              typeof entry.message.content === "string"
                ? entry.message.content
                : JSON.stringify(entry.message.content);
            if (/不对|错了|应该|wrong|incorrect|should be/i.test(text)) {
              stats.hasCorrections = true;
            }
          }

          // 提取 tool_result（检测错误）
          if (entry.message && Array.isArray(entry.message.content)) {
            for (const c of entry.message.content) {
              if (c.type === "tool_result" && c.is_error) {
                stats.errorCount++;
              }
            }
          }
        }

        if (entry.type === "assistant") {
          stats.messageCount++;
          stats.assistantCount++;

          // 提取 tool_use
          if (entry.message && Array.isArray(entry.message.content)) {
            for (const c of entry.message.content) {
              if (c.type === "tool_use") {
                stats.toolCallCount++;

                // 记录文件修改
                const toolName = c.name;
                if (
                  (toolName === "Edit" || toolName === "Write") &&
                  c.input?.file_path
                ) {
                  const fp = c.input.file_path;
                  if (!stats.modifiedFiles[fp]) {
                    stats.modifiedFiles[fp] = { tool: toolName, count: 0 };
                  }
                  stats.modifiedFiles[fp].count++;
                }
              }
            }
          }
        }
      } catch {
        // 忽略单行解析错误
      }
    }
  } catch {
    // 文件读取失败
  }

  return stats;
}

// ==================== Session 文件管理 (F10) ====================

/**
 * 获取 sessions 目录路径
 */
function getSessionsDir() {
  return path.join(getMemoryBankDir(), "sessions");
}

/**
 * 生成 session 文件名
 */
function getSessionFileName() {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5).replace(":", ""); // HHmm
  return `${date}-${time}.md`;
}

/**
 * 生成 session 摘要内容
 */
function generateSessionSummary(stats, patterns) {
  const lines = [];
  const now = new Date();
  lines.push(
    `# Session: ${now.toISOString().split("T")[0]} ${now.toTimeString().slice(0, 5)}`,
  );
  lines.push("");
  lines.push("## 统计");
  lines.push("");
  lines.push(
    `- 消息数: ${stats.messageCount} (用户: ${stats.userCount}, 助手: ${stats.assistantCount})`,
  );
  lines.push(`- 工具调用: ${stats.toolCallCount}`);
  lines.push(`- 错误数: ${stats.errorCount}`);

  // 文件列表
  const files = Object.entries(stats.modifiedFiles);
  if (files.length > 0) {
    lines.push("");
    lines.push("## 修改的文件");
    lines.push("");
    // 按修改次数降序，最多 10 个
    const sorted = files.sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    for (const [fp, info] of sorted) {
      const basename = path.basename(fp);
      lines.push(`- ${basename} (${info.tool} x${info.count})`);
    }
    if (files.length > 10) {
      lines.push(`- ... 及其他 ${files.length - 10} 个文件`);
    }
  }

  // 检测到的模式
  if (patterns.length > 0) {
    lines.push("");
    lines.push("## 检测到的模式");
    lines.push("");
    for (const p of patterns) {
      lines.push(`- ${p.pattern}: ${p.count} 次`);
    }
  }

  let content = lines.join("\n") + "\n";

  // 截断保护
  if (content.length > SESSION_MAX_SIZE) {
    content = content.slice(0, SESSION_MAX_SIZE - 20) + "\n\n...(已截断)\n";
  }

  return content;
}

/**
 * 写入 session 文件
 */
function writeSessionFile(stats, patterns) {
  const sessionsDir = getSessionsDir();
  ensureDir(sessionsDir);

  const fileName = getSessionFileName();
  const filePath = path.join(sessionsDir, fileName);
  const content = generateSessionSummary(stats, patterns);

  writeFile(filePath, content);
  return filePath;
}

/**
 * 清理过期 session 文件
 */
function cleanupExpiredSessions() {
  const sessionsDir = getSessionsDir();
  if (!fs.existsSync(sessionsDir)) return 0;

  let cleaned = 0;
  try {
    const files = fs.readdirSync(sessionsDir);
    const now = Date.now();
    const maxAgeMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const fp = path.join(sessionsDir, file);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fp);
          cleaned++;
        }
      } catch {
        // 忽略单文件错误
      }
    }
  } catch {
    // 忽略目录读取错误
  }
  return cleaned;
}

// ==================== Pattern 聚合 (F4) ====================

/**
 * 从 observations.jsonl 聚合当前 session 的 pattern
 */
function getSessionPatterns(sessionId) {
  const mbDir = getMemoryBankDir();
  const obsPath = path.join(mbDir, "observations.jsonl");
  const content = readFile(obsPath);
  if (!content) return [];

  const patternCounts = {};
  const lines = content.split("\n").filter(Boolean);

  for (const line of lines) {
    try {
      const obs = JSON.parse(line);
      if (obs.sessionId === sessionId) {
        const key = obs.pattern || "unknown";
        patternCounts[key] = (patternCounts[key] || 0) + 1;
      }
    } catch {
      // 跳过
    }
  }

  return Object.entries(patternCounts).map(([pattern, count]) => ({
    pattern,
    count,
  }));
}

/**
 * 全局 pattern_id 聚合 + 高置信度候选标记 (F4)
 *
 * 读取全部 observations.jsonl，按 pattern_id 统计全局 occurrence，
 * 超过阈值的标记为 evolution_candidate。
 */
function aggregateGlobalPatterns() {
  if (!ENABLE_DYNAMIC_CONFIDENCE) return;

  const mbDir = getMemoryBankDir();
  const obsPath = path.join(mbDir, "observations.jsonl");
  const content = readFile(obsPath);
  if (!content) return;

  const lines = content.split("\n").filter(Boolean);
  const patternIdMap = {}; // pattern_id -> { count, sessions, confidence }

  for (const line of lines) {
    try {
      const obs = JSON.parse(line);
      const pid = obs.pattern_id || `${obs.pattern}:${obs.file || "unknown"}`;

      if (!patternIdMap[pid]) {
        patternIdMap[pid] = { count: 0, sessions: new Set() };
      }
      patternIdMap[pid].count++;
      patternIdMap[pid].sessions.add(obs.sessionId);
    } catch {
      // 跳过
    }
  }

  // 计算动态置信度
  const candidates = [];
  for (const [pid, data] of Object.entries(patternIdMap)) {
    const level = CONFIDENCE_LEVELS.find(
      (l) => data.count >= l.min && data.count <= l.max,
    );
    const confidence = level ? level.value : 0.9;

    if (confidence >= 0.7) {
      candidates.push({
        pattern_id: pid,
        occurrence: data.count,
        sessions: data.sessions.size,
        confidence,
        evolution_candidate: confidence >= 0.7,
      });
    }
  }

  // 输出高置信度候选到 stderr
  if (candidates.length > 0) {
    log("");
    log(
      `[Instinct] ${candidates.length} 个高置信度模式候选 (occurrence >= 4):`,
    );
    for (const c of candidates.slice(0, 5)) {
      const label = c.confidence >= 0.9 ? "🔵 可固化" : "🟡 待验证";
      log(
        `  ${label} ${c.pattern_id}: ${c.occurrence} 次, ${c.sessions} 个 session, 置信度 ${c.confidence}`,
      );
    }
    if (candidates.length > 5) {
      log(`  ... 及其他 ${candidates.length - 5} 个候选`);
    }
    log(`[Instinct] 使用 /learn --promote 将高置信度模式固化为规则`);
    log("");
  }
}

// ==================== 主函数 ====================

/**
 * 确保学习目录存在
 */
function ensureLearnedDir(workingDir) {
  const learnedPath = path.join(workingDir, LEARNED_DIR);
  ensureDir(learnedPath);
  return learnedPath;
}

async function main() {
  try {
    const input = await readStdinJson();
    const workingDir = input.working_directory || process.cwd();
    const transcriptPath =
      input.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH;

    // 解析 transcript (F10)
    const stats = parseTranscript(transcriptPath);

    // 短会话跳过
    if (stats.messageCount < MIN_SESSION_LENGTH) {
      process.exit(0);
    }

    // 确保学习目录存在
    ensureLearnedDir(workingDir);

    // 获取当前 session 的模式 (F10 + F4)
    const sessionId = getSessionIdShort("unknown");
    const patterns = getSessionPatterns(sessionId);

    // 写入 session 摘要文件 (F10)
    const sessionFile = writeSessionFile(stats, patterns);
    log("");
    log(`[Session] 会话摘要已保存: ${path.relative(workingDir, sessionFile)}`);
    log(
      `[Session] ${stats.messageCount} 消息, ${stats.toolCallCount} 工具调用, ${stats.errorCount} 错误`,
    );

    const fileCount = Object.keys(stats.modifiedFiles).length;
    if (fileCount > 0) {
      log(`[Session] 修改了 ${fileCount} 个文件`);
    }

    // 清理过期 session (F10)
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      log(`[Session] 清理了 ${cleaned} 个过期 session 文件`);
    }

    // 全局 pattern 聚合 (F4)
    aggregateGlobalPatterns();

    // 学习提示
    if (stats.hasCorrections || stats.errorCount > 3) {
      log("[Learning] 本次会话包含纠正/较多错误，建议使用 /learn 提取模式");
    }

    log("");
    process.exit(0);
  } catch {
    // 静默失败，不影响会话结束
    process.exit(0);
  }
}

main();

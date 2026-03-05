#!/usr/bin/env node
/**
 * evaluate-session.js 单元测试
 *
 * 覆盖范围: 退出码安全、短会话跳过、session 文件写入、
 *           transcript 解析、过期清理、高置信度候选标记
 * 使用 node:test + node:assert/strict（零依赖）
 */

const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_SCRIPT = path.resolve(
  __dirname,
  "../../scripts/node/hooks/evaluate-session.js",
);

// ==================== 测试辅助 ====================

/**
 * 创建临时工作目录，包含必要的子目录结构
 * @returns {string} 临时目录路径
 */
function createTempWorkdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-session-test-"));
  fs.mkdirSync(path.join(dir, "memory-bank", "sessions"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".claude", "learned"), { recursive: true });
  return dir;
}

/**
 * 递归删除目录（跨平台）
 */
function rmrf(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

/**
 * 构建 transcript JSONL 内容
 * 生成 msgCount 条消息（user/assistant 交替），其中包含工具调用
 *
 * @param {object} options
 * @param {number} options.msgCount       - 消息总数（user+assistant 各半）
 * @param {number} options.toolCallCount  - 工具调用总数（均匀分布在 assistant 消息中）
 * @param {number} options.errorCount     - tool_result 中 is_error=true 的数量
 * @param {boolean} options.hasCorrections - 是否在 user 消息中加入纠正文本
 * @returns {string} JSONL 内容
 */
function buildTranscriptJsonl(options = {}) {
  const {
    msgCount = 20,
    toolCallCount = 5,
    errorCount = 0,
    hasCorrections = false,
  } = options;

  const lines = [];
  const halfCount = Math.floor(msgCount / 2);

  for (let i = 0; i < halfCount; i++) {
    // assistant 消息（可含工具调用）
    const assistantContent = [];

    // 分配工具调用
    const toolsThisMsg = i === 0 ? toolCallCount : 0;
    for (let t = 0; t < toolsThisMsg; t++) {
      assistantContent.push({
        type: "tool_use",
        id: `tool_${i}_${t}`,
        name: "Read",
        input: { file_path: `/tmp/test-file-${t}.txt` },
      });
    }
    // 总是有文本内容
    assistantContent.push({ type: "text", text: `回复 ${i}` });

    lines.push(
      JSON.stringify({
        type: "assistant",
        message: { content: assistantContent },
      }),
    );

    // user 消息（可含 tool_result 和纠正文本）
    const userContent = [];

    // 分配错误结果
    const errorsThisMsg = i === 0 ? errorCount : 0;
    for (let e = 0; e < errorsThisMsg; e++) {
      userContent.push({
        type: "tool_result",
        tool_use_id: `tool_${i}_${e}`,
        content: "错误信息",
        is_error: true,
      });
    }

    const userText =
      hasCorrections && i === 1 ? "不对，应该这样做" : `用户消息 ${i}`;
    userContent.push({ type: "text", text: userText });

    lines.push(
      JSON.stringify({
        type: "user",
        message: { content: userContent },
      }),
    );
  }

  return lines.join("\n") + "\n";
}

/**
 * 运行 hook 脚本
 *
 * @param {object} options
 * @param {string} options.workingDir    - 工作目录（作为 cwd 和 stdin 中的 working_directory）
 * @param {string} [options.transcriptPath] - transcript JSONL 路径
 * @param {string} [options.sessionId]  - CLAUDE_SESSION_ID 环境变量值
 * @param {object} [options.env]        - 额外环境变量
 * @returns {{ exitCode: number, stderr: string, stdout: string }}
 */
function runHook(options = {}) {
  const {
    workingDir,
    transcriptPath = "",
    sessionId,
    env: extraEnv = {},
  } = options;

  const sid =
    sessionId || `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const stdinPayload = JSON.stringify({
    working_directory: workingDir,
    transcript_path: transcriptPath,
  });

  const result = spawnSync("node", [HOOK_SCRIPT], {
    encoding: "utf8",
    timeout: 15000,
    input: stdinPayload,
    cwd: workingDir,
    env: {
      ...process.env,
      CLAUDE_SESSION_ID: sid,
      ...extraEnv,
    },
  });

  return {
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
  };
}

/**
 * 列出目录下的 .md 文件
 */
function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

// ==================== 退出码安全 ====================

describe("退出码安全", () => {
  let workingDir;

  beforeEach(() => {
    workingDir = createTempWorkdir();
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  it("正常执行（足够消息数）返回 exit code 0", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { exitCode } = runHook({ workingDir, transcriptPath });
    assert.equal(exitCode, 0, "Hook 不应阻止会话结束");
  });

  it("空 stdin 不崩溃，返回 exit code 0", () => {
    const result = spawnSync("node", [HOOK_SCRIPT], {
      encoding: "utf8",
      timeout: 10000,
      input: "",
      cwd: workingDir,
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: `empty-stdin-${Date.now()}`,
      },
    });
    assert.equal(result.status, 0, "空 stdin 不应崩溃");
  });

  it("无效 JSON stdin 不崩溃，返回 exit code 0", () => {
    const result = spawnSync("node", [HOOK_SCRIPT], {
      encoding: "utf8",
      timeout: 10000,
      input: "not-valid-json",
      cwd: workingDir,
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: `invalid-json-${Date.now()}`,
      },
    });
    assert.equal(result.status, 0, "无效 JSON 不应崩溃");
  });

  it("transcript_path 不存在时不崩溃，返回 exit code 0", () => {
    const { exitCode } = runHook({
      workingDir,
      transcriptPath: "/nonexistent/path/transcript.jsonl",
    });
    assert.equal(exitCode, 0, "缺失 transcript 不应崩溃");
  });
});

// ==================== 短会话跳过 ====================

describe("短会话跳过", () => {
  let workingDir;

  beforeEach(() => {
    workingDir = createTempWorkdir();
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  it("messageCount < 10 时不写 session 文件", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    // 生成 8 条消息（4 user + 4 assistant = 8 < 10）
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 8 }));

    const { exitCode } = runHook({ workingDir, transcriptPath });
    assert.equal(exitCode, 0, "短会话应正常退出");

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const mdFiles = listMdFiles(sessionsDir);
    assert.equal(mdFiles.length, 0, "短会话不应写入 session 文件");
  });

  it("messageCount 恰好等于 10 时写入 session 文件（边界值）", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    // 生成 10 条消息（5 user + 5 assistant = 10，等于 MIN_SESSION_LENGTH）
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 10 }));

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const mdFiles = listMdFiles(sessionsDir);
    assert.equal(mdFiles.length, 1, "恰好 10 条消息应写入 session 文件");
  });

  it("messageCount = 9 时跳过（低于阈值边界）", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    // 生成 9 条消息（不能整除，实际生成 8 条；直接构造 9 行）
    const lines = [];
    for (let i = 0; i < 9; i++) {
      const type = i % 2 === 0 ? "assistant" : "user";
      lines.push(
        JSON.stringify({
          type,
          message: { content: [{ type: "text", text: `消息 ${i}` }] },
        }),
      );
    }
    fs.writeFileSync(transcriptPath, lines.join("\n") + "\n");

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const mdFiles = listMdFiles(sessionsDir);
    assert.equal(mdFiles.length, 0, "9 条消息应跳过不写文件");
  });
});

// ==================== Session 文件写入 ====================

describe("session 文件写入", () => {
  let workingDir;
  let transcriptPath;

  beforeEach(() => {
    workingDir = createTempWorkdir();
    transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptJsonl({ msgCount: 20, toolCallCount: 5 }),
    );
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  it("在 memory-bank/sessions/ 下生成 .md 文件", () => {
    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const mdFiles = listMdFiles(sessionsDir);
    assert.equal(mdFiles.length, 1, "应生成 1 个 session 文件");
    assert.ok(mdFiles[0].endsWith(".md"), "文件应为 .md 格式");
  });

  it("文件名包含日期格式（YYYY-MM-DD）", () => {
    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const mdFiles = listMdFiles(sessionsDir);
    assert.equal(mdFiles.length, 1);

    const datePattern = /^\d{4}-\d{2}-\d{2}-\d{4}\.md$/;
    assert.ok(
      datePattern.test(mdFiles[0]),
      `文件名 "${mdFiles[0]}" 应匹配 YYYY-MM-DD-HHmm.md 格式`,
    );
  });

  it("session 文件内容不为空", () => {
    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const [fileName] = listMdFiles(sessionsDir);
    const content = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");
    assert.ok(content.length > 0, "session 文件不应为空");
  });

  it("stderr 输出 [Session] 标记", () => {
    const { stderr } = runHook({ workingDir, transcriptPath });
    assert.ok(stderr.includes("[Session]"), "应在 stderr 输出 [Session] 标记");
  });
});

// ==================== Transcript 解析：统计数据验证 ====================

describe("transcript 解析 - 统计数据", () => {
  let workingDir;

  beforeEach(() => {
    workingDir = createTempWorkdir();
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  it("session 文件包含正确的消息数", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    // 20 条消息：10 user + 10 assistant
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptJsonl({ msgCount: 20, toolCallCount: 0 }),
    );

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const [fileName] = listMdFiles(sessionsDir);
    const content = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");

    // 期望包含 "消息数: 20"
    assert.ok(
      content.includes("消息数: 20"),
      `应包含 "消息数: 20"，实际内容:\n${content}`,
    );
  });

  it("session 文件包含正确的工具调用数", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptJsonl({ msgCount: 20, toolCallCount: 7 }),
    );

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const [fileName] = listMdFiles(sessionsDir);
    const content = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");

    assert.ok(
      content.includes("工具调用: 7"),
      `应包含 "工具调用: 7"，实际内容:\n${content}`,
    );
  });

  it("session 文件包含错误数", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptJsonl({ msgCount: 20, toolCallCount: 3, errorCount: 2 }),
    );

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const [fileName] = listMdFiles(sessionsDir);
    const content = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");

    assert.ok(
      content.includes("错误数: 2"),
      `应包含 "错误数: 2"，实际内容:\n${content}`,
    );
  });

  it("stderr 输出消息数和工具调用数摘要", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptJsonl({ msgCount: 14, toolCallCount: 4 }),
    );

    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      stderr.includes("14"),
      `stderr 应包含消息数 14，实际:\n${stderr}`,
    );
    assert.ok(
      stderr.includes("4"),
      `stderr 应包含工具调用数 4，实际:\n${stderr}`,
    );
  });

  it("Write 工具调用的文件路径被记录到修改文件列表", () => {
    const transcriptPath = path.join(workingDir, "transcript.jsonl");

    // 手动构造含 Write 工具调用的 transcript
    const lines = [];
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        const content = [{ type: "text", text: "回复" }];
        if (i === 0) {
          content.unshift({
            type: "tool_use",
            id: "tool_write_1",
            name: "Write",
            input: { file_path: "/tmp/special-output.js" },
          });
        }
        lines.push(JSON.stringify({ type: "assistant", message: { content } }));
      } else {
        lines.push(
          JSON.stringify({
            type: "user",
            message: {
              content: [{ type: "text", text: `用户消息 ${i}` }],
            },
          }),
        );
      }
    }
    fs.writeFileSync(transcriptPath, lines.join("\n") + "\n");

    runHook({ workingDir, transcriptPath });

    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");
    const [fileName] = listMdFiles(sessionsDir);
    const content = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");

    assert.ok(
      content.includes("special-output.js"),
      `session 文件应记录修改的文件，实际内容:\n${content}`,
    );
  });
});

// ==================== 过期清理 ====================

describe("过期 session 文件清理", () => {
  let workingDir;

  beforeEach(() => {
    workingDir = createTempWorkdir();
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  it("mtime > 7 天的旧 session 文件被清理", () => {
    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");

    // 创建一个旧文件
    const oldFile = path.join(sessionsDir, "2020-01-01-0000.md");
    fs.writeFileSync(oldFile, "# 旧 Session\n\n## 统计\n\n- 消息数: 10\n");

    // 将文件的 mtime 设置为 8 天前
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, eightDaysAgo, eightDaysAgo);

    // 确认旧文件存在
    assert.ok(fs.existsSync(oldFile), "旧文件应预先存在");

    // 运行 hook（需要足够多消息触发执行）
    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));
    runHook({ workingDir, transcriptPath });

    // 旧文件应被删除
    assert.ok(!fs.existsSync(oldFile), "8 天前的 session 文件应被清理");
  });

  it("mtime <= 7 天的文件不被清理", () => {
    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");

    // 创建一个 6 天前的文件
    const recentFile = path.join(sessionsDir, "2999-12-30-1200.md");
    fs.writeFileSync(recentFile, "# 近期 Session\n\n## 统计\n\n- 消息数: 12\n");

    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    fs.utimesSync(recentFile, sixDaysAgo, sixDaysAgo);

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));
    runHook({ workingDir, transcriptPath });

    assert.ok(fs.existsSync(recentFile), "6 天前的 session 文件不应被清理");
  });

  it("清理过期文件后 stderr 输出清理日志", () => {
    const sessionsDir = path.join(workingDir, "memory-bank", "sessions");

    // 创建两个旧文件
    for (let i = 1; i <= 2; i++) {
      const oldFile = path.join(sessionsDir, `2020-01-0${i}-0000.md`);
      fs.writeFileSync(oldFile, "# 旧 Session\n");
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);
    }

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));
    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      stderr.includes("清理"),
      `应在 stderr 输出清理日志，实际:\n${stderr}`,
    );
  });
});

// ==================== 高置信度候选标记 ====================

describe("高置信度候选标记 (F4)", () => {
  let workingDir;

  beforeEach(() => {
    workingDir = createTempWorkdir();
  });

  afterEach(() => {
    rmrf(workingDir);
  });

  /**
   * 创建 observations.jsonl，包含多个相同 pattern_id 的记录
   * occurrence >= 4 时置信度 >= 0.7，应触发 [Instinct] 输出
   */
  function createObservations(mbDir, patternId, count, sessionIds = []) {
    const lines = [];
    for (let i = 0; i < count; i++) {
      const sid =
        sessionIds[i] ||
        `session-obs-${i}-${Math.random().toString(36).slice(2)}`;
      lines.push(
        JSON.stringify({
          pattern_id: patternId,
          pattern: "test-pattern",
          file: "test.js",
          sessionId: sid,
          timestamp: new Date().toISOString(),
        }),
      );
    }
    const obsPath = path.join(mbDir, "observations.jsonl");
    fs.writeFileSync(obsPath, lines.join("\n") + "\n");
  }

  it("observations.jsonl 中 pattern_id 出现 4 次时触发 [Instinct] 输出", () => {
    const mbDir = path.join(workingDir, "memory-bank");
    createObservations(mbDir, "test-pattern:test.js", 4);

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      stderr.includes("[Instinct]"),
      `occurrence=4 应触发 [Instinct] 输出，实际 stderr:\n${stderr}`,
    );
  });

  it("pattern_id 出现 7 次时置信度为 0.9，输出中包含置信度信息", () => {
    const mbDir = path.join(workingDir, "memory-bank");
    createObservations(mbDir, "high-confidence-pattern:main.js", 7);

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      stderr.includes("[Instinct]"),
      `occurrence=7 应触发 [Instinct] 输出，实际 stderr:\n${stderr}`,
    );
    assert.ok(
      stderr.includes("0.9"),
      `置信度为 0.9 应出现在输出中，实际 stderr:\n${stderr}`,
    );
  });

  it("pattern_id 出现 3 次时（置信度 0.5）不触发 [Instinct]", () => {
    const mbDir = path.join(workingDir, "memory-bank");
    createObservations(mbDir, "low-confidence-pattern:low.js", 3);

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      !stderr.includes("[Instinct]"),
      `occurrence=3（置信度 0.5）不应触发 [Instinct]，实际 stderr:\n${stderr}`,
    );
  });

  it("输出提示使用 /learn --promote 固化规则", () => {
    const mbDir = path.join(workingDir, "memory-bank");
    createObservations(mbDir, "promotable-pattern:src.js", 5);

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { stderr } = runHook({ workingDir, transcriptPath });

    assert.ok(
      stderr.includes("/learn"),
      `应提示使用 /learn 命令，实际 stderr:\n${stderr}`,
    );
  });

  it("无 observations.jsonl 时不崩溃", () => {
    // 不创建 observations.jsonl

    const transcriptPath = path.join(workingDir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, buildTranscriptJsonl({ msgCount: 20 }));

    const { exitCode } = runHook({ workingDir, transcriptPath });
    assert.equal(exitCode, 0, "无 observations.jsonl 不应崩溃");
  });
});

// ==================== --help 支持 ====================

describe("--help 参数", () => {
  it("--help 输出帮助文本并返回 exit code 0", () => {
    const result = spawnSync("node", [HOOK_SCRIPT, "--help"], {
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, "--help 应返回 exit code 0");
    assert.ok(
      result.stdout.includes("evaluate-session"),
      "--help 应输出脚本名称",
    );
  });
});

#!/usr/bin/env node
/**
 * observe-patterns.js 单元测试
 *
 * 覆盖范围: 退出码安全、pattern_id 生成、occurrence 累积、红旗检测(F12)、动态置信度(F4)
 * 使用 node:test + node:assert/strict（零依赖）
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_SCRIPT = path.resolve(
  __dirname,
  "../../scripts/node/hooks/observe-patterns.js",
);

// ==================== 测试辅助 ====================

/**
 * 生成唯一的测试会话 ID
 */
function makeSessionId(prefix = "obs-test") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 获取历史文件路径（与脚本逻辑一致：tmpdir/claude-observe-{后8位}.jsonl）
 */
function getHistoryPath(sessionId) {
  const short = sessionId.slice(-8);
  return path.join(os.tmpdir(), `claude-observe-${short}.jsonl`);
}

/**
 * 获取 observations.jsonl 路径
 */
function getObsPath(tmpCwd) {
  return path.join(tmpCwd, "memory-bank", "observations.jsonl");
}

/**
 * 读取 observations.jsonl，返回解析后的对象数组
 */
function readObservations(tmpCwd) {
  const obsPath = getObsPath(tmpCwd);
  if (!fs.existsSync(obsPath)) return [];
  const content = fs.readFileSync(obsPath, "utf8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 创建临时工作目录（每个测试独立 cwd，避免 observations.jsonl 污染）
 */
function makeTmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "obs-test-cwd-"));
}

/**
 * 清理临时目录
 */
function cleanupTmpCwd(tmpCwd) {
  try {
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  } catch {
    // 忽略
  }
}

/**
 * 清理历史文件
 */
function cleanupHistory(sessionId) {
  try {
    fs.unlinkSync(getHistoryPath(sessionId));
  } catch {
    // 忽略
  }
}

/**
 * 运行 hook 脚本
 * @param {object} stdinData - 传入 hook 的 JSON 数据
 * @param {object} options - { sessionId, env, cwd }
 * @returns {{ exitCode, stderr, stdout }}
 */
function runHook(stdinData = {}, options = {}) {
  const sessionId = options.sessionId || makeSessionId();
  const cwd = options.cwd || os.tmpdir();

  const env = {
    ...process.env,
    CLAUDE_SESSION_ID: sessionId,
    ...options.env,
  };

  const result = spawnSync("node", [HOOK_SCRIPT], {
    encoding: "utf8",
    timeout: 10000,
    input: JSON.stringify(stdinData),
    env,
    cwd,
  });

  return {
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
  };
}

/**
 * 构造 Edit 工具的 stdin 数据
 */
function makeEditInput(filePath) {
  return {
    tool_name: "Edit",
    tool_input: { file_path: filePath },
    tool_result: { exit_code: 0 },
  };
}

/**
 * 构造 Bash 工具（带错误）的 stdin 数据
 */
function makeBashErrorInput(exitCode = 1) {
  return {
    tool_name: "Bash",
    tool_input: { command: "npm test" },
    tool_result: { exit_code: exitCode },
  };
}

// ==================== 退出码安全 ====================

describe("退出码安全", () => {
  it("正常执行返回 exit code 0", () => {
    const sessionId = makeSessionId("exitcode");
    const tmpCwd = makeTmpCwd();
    try {
      const { exitCode } = runHook(makeEditInput("/tmp/foo.js"), {
        sessionId,
        cwd: tmpCwd,
      });
      assert.equal(exitCode, 0, "hook 不应阻止操作");
    } finally {
      cleanupHistory(sessionId);
      cleanupTmpCwd(tmpCwd);
    }
  });

  it("无 stdin 输入时返回 exit code 0", () => {
    const sessionId = makeSessionId("empty-stdin");
    const tmpCwd = makeTmpCwd();
    const result = spawnSync("node", [HOOK_SCRIPT], {
      encoding: "utf8",
      timeout: 10000,
      input: "",
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      cwd: tmpCwd,
    });
    try {
      assert.equal(result.status, 0, "无输入时不应崩溃");
    } finally {
      cleanupHistory(sessionId);
      cleanupTmpCwd(tmpCwd);
    }
  });

  it("无效 JSON stdin 时返回 exit code 0", () => {
    const sessionId = makeSessionId("invalid-json");
    const tmpCwd = makeTmpCwd();
    const result = spawnSync("node", [HOOK_SCRIPT], {
      encoding: "utf8",
      timeout: 10000,
      input: "not-valid-json{{{",
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      cwd: tmpCwd,
    });
    try {
      assert.equal(result.status, 0, "无效 JSON 时不应崩溃");
    } finally {
      cleanupHistory(sessionId);
      cleanupTmpCwd(tmpCwd);
    }
  });
});

// ==================== pattern_id 生成 ====================

describe("pattern_id 生成", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("patid");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("multi_file_edit 模式生成目录级 pattern_id", () => {
    // 3 个不同文件同目录 → 触发 multi_file_edit
    // 使用绝对路径确保跨平台一致性
    const dir = os.tmpdir().replace(/\\/g, "/");
    const file1 = dir + "/a.ts";
    const file2 = dir + "/b.ts";
    const file3 = dir + "/c.ts";

    const histPath = getHistoryPath(sessionId);
    const now = Date.now();
    fs.writeFileSync(
      histPath,
      [
        JSON.stringify({
          tool: "Edit",
          file: file1,
          exitCode: 0,
          ts: now - 2000,
        }),
        JSON.stringify({
          tool: "Edit",
          file: file2,
          exitCode: 0,
          ts: now - 1000,
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    // 第 3 个文件 Edit → 触发 multi_file_edit
    runHook(makeEditInput(file3), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    assert.ok(obs.length > 0, "应写入 observation");

    const multiEdit = obs.find((o) => o.pattern === "multi_file_edit");
    assert.ok(multiEdit, "应检测到 multi_file_edit 模式");
    // pattern_id 格式: "multi_file_edit:{dirname}/"
    assert.ok(
      multiEdit.pattern_id.startsWith("multi_file_edit:"),
      "pattern_id 应以 multi_file_edit: 开头",
    );
  });

  it("error_fix 模式生成目录级 pattern_id", () => {
    const dir = os.tmpdir().replace(/\\/g, "/");
    const filePath = dir + "/login.ts";

    // 预写 Bash 错误历史
    const histPath = getHistoryPath(sessionId);
    const bashError = JSON.stringify({
      tool: "Bash",
      file: "",
      exitCode: 1,
      ts: Date.now() - 1000,
    });
    fs.writeFileSync(histPath, bashError + "\n", "utf8");

    // Edit 同文件 → 触发 error_fix（error_fix 优先于其他模式）
    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    assert.ok(obs.length > 0, "应写入 observation");
    const errorFix = obs.find((o) => o.pattern === "error_fix");
    assert.ok(errorFix, "应检测到 error_fix 模式");
    // pattern_id 格式: "error_fix:{dirname}"
    assert.ok(
      errorFix.pattern_id.startsWith("error_fix:"),
      "pattern_id 应以 error_fix: 开头",
    );
  });
});

// ==================== occurrence 累积 ====================

describe("occurrence 累积", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("occur");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("同 pattern_id 的 occurrence 应递增", () => {
    // 使用 error_fix 模式：Bash 错误后 Edit 同文件，方便重复触发
    const dir = os.tmpdir().replace(/\\/g, "/");
    const filePath = dir + "/utils.ts";
    const histPath = getHistoryPath(sessionId);

    // 第一轮：预写 Bash 错误，触发 error_fix
    fs.writeFileSync(
      histPath,
      JSON.stringify({
        tool: "Bash",
        file: "",
        exitCode: 1,
        ts: Date.now() - 1000,
      }) + "\n",
      "utf8",
    );
    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    // 第二轮：重置历史，再次触发 error_fix（同 pattern_id）
    fs.writeFileSync(
      histPath,
      JSON.stringify({
        tool: "Bash",
        file: "",
        exitCode: 1,
        ts: Date.now() - 1000,
      }) + "\n",
      "utf8",
    );
    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    assert.ok(obs.length >= 2, "应有 2 条以上 observation");

    // error_fix pattern_id 为 "error_fix:{dirname}"
    const dirName = path.basename(path.dirname(filePath));
    const expectedPatternId = `error_fix:${dirName}`;
    const occurrences = obs
      .filter((o) => o.pattern_id === expectedPatternId)
      .map((o) => o.occurrence)
      .sort((a, b) => a - b);

    assert.ok(
      occurrences.length >= 2,
      `应有 2 条 pattern_id=${expectedPatternId} 的记录`,
    );
    assert.equal(occurrences[0], 1, "第 1 次 occurrence 应为 1");
    assert.equal(occurrences[1], 2, "第 2 次 occurrence 应为 2");
  });
});

// ==================== 红旗检测 (F12) ====================

describe("红旗检测 F12", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("redflag");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("同文件 Edit 3+ 次 + 最近 Bash 错误 2+ 次时 stderr 包含 [RedFlag]", () => {
    const filePath = "/tmp/src/broken.ts";
    const histPath = getHistoryPath(sessionId);

    // 构造历史：2 次 Edit + 2 次 Bash 错误（共 4 条），顺序是最近 5 条内
    const now = Date.now();
    const history = [
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 5000 },
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 4000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 3000 },
      { tool: "Bash", file: "", exitCode: 2, ts: now - 2000 },
    ];
    fs.writeFileSync(
      histPath,
      history.map((h) => JSON.stringify(h)).join("\n") + "\n",
      "utf8",
    );

    // 第 3 次 Edit 同文件 → 触发红旗
    const { stderr } = runHook(makeEditInput(filePath), {
      sessionId,
      cwd: tmpCwd,
    });

    assert.ok(
      stderr.includes("[RedFlag]"),
      `stderr 应包含 [RedFlag]，实际 stderr: ${stderr}`,
    );
  });

  it("同文件 Edit 不足 3 次时不触发红旗", () => {
    const filePath = "/tmp/src/normal.ts";
    const histPath = getHistoryPath(sessionId);

    // 只有 1 条同文件历史 + 2 条 Bash 错误
    const now = Date.now();
    const history = [
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 3000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 2000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 1000 },
    ];
    fs.writeFileSync(
      histPath,
      history.map((h) => JSON.stringify(h)).join("\n") + "\n",
      "utf8",
    );

    // 第 2 次 Edit → 不触发红旗（需要 3+ 次才触发）
    const { stderr } = runHook(makeEditInput(filePath), {
      sessionId,
      cwd: tmpCwd,
    });

    assert.ok(!stderr.includes("[RedFlag]"), "不足 3 次 Edit 时不应触发红旗");
  });

  it("Bash 错误不足 2 次时不触发红旗", () => {
    const filePath = "/tmp/src/ok.ts";
    const histPath = getHistoryPath(sessionId);

    // 2 次同文件 Edit + 仅 1 次 Bash 错误
    const now = Date.now();
    const history = [
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 3000 },
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 2000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 1000 },
    ];
    fs.writeFileSync(
      histPath,
      history.map((h) => JSON.stringify(h)).join("\n") + "\n",
      "utf8",
    );

    const { stderr } = runHook(makeEditInput(filePath), {
      sessionId,
      cwd: tmpCwd,
    });

    assert.ok(
      !stderr.includes("[RedFlag]"),
      "Bash 错误不足 2 次时不应触发红旗",
    );
  });

  it("红旗检测不影响退出码（始终返回 0）", () => {
    const filePath = "/tmp/src/unstable.ts";
    const histPath = getHistoryPath(sessionId);

    const now = Date.now();
    const history = [
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 4000 },
      { tool: "Edit", file: filePath, exitCode: 0, ts: now - 3000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 2000 },
      { tool: "Bash", file: "", exitCode: 1, ts: now - 1000 },
    ];
    fs.writeFileSync(
      histPath,
      history.map((h) => JSON.stringify(h)).join("\n") + "\n",
      "utf8",
    );

    const { exitCode } = runHook(makeEditInput(filePath), {
      sessionId,
      cwd: tmpCwd,
    });

    assert.equal(exitCode, 0, "红旗检测触发后退出码仍应为 0");
  });
});

// ==================== 动态置信度 (F4) ====================

describe("动态置信度 F4", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("dynconf");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("首次检测（occurrence=1）时 confidence 为 0.3", () => {
    // 使用 error_fix 模式：Bash 错误后 Edit → occurrence=1 → confidence=0.3
    const dir = os.tmpdir().replace(/\\/g, "/");
    const filePath = dir + "/first.ts";
    const histPath = getHistoryPath(sessionId);

    fs.writeFileSync(
      histPath,
      JSON.stringify({
        tool: "Bash",
        file: "",
        exitCode: 1,
        ts: Date.now() - 1000,
      }) + "\n",
      "utf8",
    );

    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    const errorFix = obs.find((o) => o.pattern === "error_fix");
    assert.ok(errorFix, "应检测到 error_fix");
    assert.equal(errorFix.occurrence, 1, "首次 occurrence 应为 1");
    // occurrence=1 时 getDynamicConfidence 返回 0.3
    assert.equal(
      errorFix.confidence,
      0.3,
      "occurrence=1 时 confidence 应为 0.3",
    );
  });

  it("occurrence=2 时 confidence 提升为 0.5", () => {
    // 通过预写 observations.jsonl 模拟已有 1 次记录，再触发第 2 次
    const dir = os.tmpdir().replace(/\\/g, "/");
    const filePath = dir + "/second.ts";
    const histPath = getHistoryPath(sessionId);
    const mbDir = path.join(tmpCwd, "memory-bank");
    const shortId = sessionId.slice(-8);
    const dirName = path.basename(
      path.dirname(filePath.replace(/\//g, path.sep)),
    );
    const patternId = `error_fix:${dirName}`;

    // 预写 observations.jsonl：模拟同 sessionId、同 pattern_id 已有 1 条
    fs.mkdirSync(mbDir, { recursive: true });
    const existingObs = JSON.stringify({
      sessionId: shortId,
      pattern_id: patternId,
      pattern: "error_fix",
      confidence: 0.3,
      occurrence: 1,
    });
    fs.writeFileSync(
      path.join(mbDir, "observations.jsonl"),
      existingObs + "\n",
      "utf8",
    );

    // 预写 Bash 错误历史，触发第 2 次 error_fix
    fs.writeFileSync(
      histPath,
      JSON.stringify({
        tool: "Bash",
        file: "",
        exitCode: 1,
        ts: Date.now() - 1000,
      }) + "\n",
      "utf8",
    );

    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    const errorFixObs = obs.filter((o) => o.pattern === "error_fix");
    const second = errorFixObs.find((o) => o.occurrence === 2);
    assert.ok(second, `应有 occurrence=2 的记录（patternId=${patternId}）`);
    // occurrence=2 时 getDynamicConfidence 返回 0.5
    assert.equal(second.confidence, 0.5, "occurrence=2 时 confidence 应为 0.5");
  });
});

// ==================== Session 隔离 ====================

describe("Session 隔离", () => {
  it("不同 session 的历史文件相互独立", () => {
    const session1 = makeSessionId("iso1");
    const session2 = makeSessionId("iso2");
    const tmpCwd1 = makeTmpCwd();
    const tmpCwd2 = makeTmpCwd();
    // 使用 error_fix 模式：session1 有 Bash 错误历史，session2 没有
    const dir = os.tmpdir().replace(/\\/g, "/");
    const filePath = dir + "/shared.ts";

    try {
      // session1: 预写 Bash 错误历史 → 触发 error_fix
      const hist1 = getHistoryPath(session1);
      fs.writeFileSync(
        hist1,
        JSON.stringify({
          tool: "Bash",
          file: "",
          exitCode: 1,
          ts: Date.now() - 1000,
        }) + "\n",
        "utf8",
      );
      runHook(makeEditInput(filePath), { sessionId: session1, cwd: tmpCwd1 });

      // session2: 无历史，不触发任何模式
      runHook(makeEditInput(filePath), { sessionId: session2, cwd: tmpCwd2 });

      const obs1 = readObservations(tmpCwd1);
      const obs2 = readObservations(tmpCwd2);

      assert.ok(
        obs1.some((o) => o.pattern === "error_fix"),
        "session1 应有 error_fix 记录",
      );
      assert.ok(
        !obs2.some((o) => o.pattern === "error_fix"),
        "session2 无历史，不应有 error_fix 记录",
      );
    } finally {
      cleanupHistory(session1);
      cleanupHistory(session2);
      cleanupTmpCwd(tmpCwd1);
      cleanupTmpCwd(tmpCwd2);
    }
  });
});

// ==================== 历史追加 ====================

describe("历史追加", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("hist");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("每次调用后历史文件中追加一条记录", () => {
    const histPath = getHistoryPath(sessionId);

    runHook(makeEditInput("/tmp/a.ts"), { sessionId, cwd: tmpCwd });
    assert.ok(fs.existsSync(histPath), "历史文件应被创建");

    const lines1 = fs
      .readFileSync(histPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    assert.equal(lines1.length, 1, "首次调用后应有 1 条历史");

    runHook(makeBashErrorInput(1), { sessionId, cwd: tmpCwd });

    const lines2 = fs
      .readFileSync(histPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    assert.equal(lines2.length, 2, "第 2 次调用后应有 2 条历史");
  });

  it("历史文件超过 MAX_HISTORY×3 行时自动截断", () => {
    const histPath = getHistoryPath(sessionId);
    const maxHistory = 5; // 对应 MAX_HISTORY=5

    // 写入超过 5×3=15 行的历史（写 16 行）
    const entries = Array.from({ length: 16 }, (_, i) =>
      JSON.stringify({
        tool: "Bash",
        file: "",
        exitCode: 0,
        ts: Date.now() + i,
      }),
    );
    fs.writeFileSync(histPath, entries.join("\n") + "\n", "utf8");

    // 再调用一次触发清理
    runHook(
      { tool_name: "Bash", tool_input: {}, tool_result: { exit_code: 0 } },
      { sessionId, cwd: tmpCwd, env: { MAX_HISTORY: String(maxHistory) } },
    );

    const lines = fs
      .readFileSync(histPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    // 截断后应保留 MAX_HISTORY 条 + 新的 1 条 = 最多 MAX_HISTORY+1 条
    assert.ok(
      lines.length <= maxHistory + 1,
      `截断后行数应 <= ${maxHistory + 1}，实际: ${lines.length}`,
    );
  });
});

// ==================== observations.jsonl 写入 ====================

describe("observations.jsonl 写入", () => {
  let sessionId;
  let tmpCwd;

  beforeEach(() => {
    sessionId = makeSessionId("obswrite");
    tmpCwd = makeTmpCwd();
  });

  afterEach(() => {
    cleanupHistory(sessionId);
    cleanupTmpCwd(tmpCwd);
  });

  it("observation 包含必要字段", () => {
    const filePath = "/tmp/src/target.ts";
    const histPath = getHistoryPath(sessionId);

    const now = Date.now();
    fs.writeFileSync(
      histPath,
      [
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 2000,
        }),
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 1000,
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    assert.ok(obs.length > 0, "应有 observation 写入");

    const record = obs[0];
    // 验证必要字段存在
    assert.ok("sessionId" in record, "应有 sessionId 字段");
    assert.ok("timestamp" in record, "应有 timestamp 字段");
    assert.ok("pattern" in record, "应有 pattern 字段");
    assert.ok("pattern_id" in record, "应有 pattern_id 字段");
    assert.ok("confidence" in record, "应有 confidence 字段");
    assert.ok("occurrence" in record, "应有 occurrence 字段");
    assert.ok("context" in record, "应有 context 字段");
  });

  it("sessionId 字段为 CLAUDE_SESSION_ID 的后 8 位", () => {
    const filePath = "/tmp/src/check-session.ts";
    const histPath = getHistoryPath(sessionId);

    const now = Date.now();
    fs.writeFileSync(
      histPath,
      [
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 2000,
        }),
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 1000,
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    runHook(makeEditInput(filePath), { sessionId, cwd: tmpCwd });

    const obs = readObservations(tmpCwd);
    assert.ok(obs.length > 0, "应有 observation");
    assert.equal(
      obs[0].sessionId,
      sessionId.slice(-8),
      "sessionId 应为 CLAUDE_SESSION_ID 的后 8 位",
    );
  });

  it("observations.jsonl 超过 MAX_OBSERVATIONS 时截断旧条目", () => {
    // 用 MAX_OBSERVATIONS=4 测试截断逻辑（脚本默认 200，通过环境变量覆盖）
    const maxObs = 4;
    const filePath = "/tmp/src/trim.ts";
    const mbDir = path.join(tmpCwd, "memory-bank");
    fs.mkdirSync(mbDir, { recursive: true });

    // 预写 4 条（达到上限）
    const existing = Array.from({ length: 4 }, (_, i) =>
      JSON.stringify({
        sessionId: "old",
        pattern_id: `p:${i}`,
        pattern: "fix_retry",
      }),
    );
    fs.writeFileSync(
      path.join(mbDir, "observations.jsonl"),
      existing.join("\n") + "\n",
      "utf8",
    );

    // 触发 fix_retry，此时写入第 5 条 → 超过 MAX_OBSERVATIONS=4 → 截断
    const histPath = getHistoryPath(sessionId);
    const now = Date.now();
    fs.writeFileSync(
      histPath,
      [
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 2000,
        }),
        JSON.stringify({
          tool: "Edit",
          file: filePath,
          exitCode: 0,
          ts: now - 1000,
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    runHook(makeEditInput(filePath), {
      sessionId,
      cwd: tmpCwd,
      env: { MAX_OBSERVATIONS: String(maxObs) },
    });

    const obs = readObservations(tmpCwd);
    // 截断后应保留 MAX_OBSERVATIONS/2=2 条旧的 + 1 条新的 = 3 条
    assert.ok(
      obs.length <= maxObs,
      `截断后 observations 数量应 <= ${maxObs}，实际: ${obs.length}`,
    );
  });
});

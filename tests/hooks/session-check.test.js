#!/usr/bin/env node
/**
 * session-check.js 单元测试
 *
 * 覆盖范围: 退出码安全、JSON 输出有效性、session 恢复、无 session 目录时静默、additionalContext 格式
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
  "../../scripts/node/hooks/session-check.js",
);

// ==================== 测试辅助 ====================

/**
 * 创建临时项目目录，包含 CLAUDE.md
 * @returns {string} 临时目录路径
 */
function createTempProjectDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-check-test-"));
  // session-check.js 会检查 CLAUDE.md，创建空文件避免报错
  fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Test Project\n");
  return tmpDir;
}

/**
 * 递归删除目录
 * @param {string} dirPath
 */
function removeDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * 运行 hook 脚本并捕获输出
 * @param {string} cwd - 工作目录（临时项目目录）
 * @param {object} options - { env: 额外环境变量 }
 * @returns {{ exitCode, stderr, stdout }}
 */
function runHook(cwd, options = {}) {
  const env = {
    ...process.env,
    ...options.env,
  };

  const result = spawnSync("node", [HOOK_SCRIPT], {
    encoding: "utf8",
    timeout: 10000,
    cwd,
    env,
  });

  return {
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
  };
}

/**
 * 在临时目录中创建 session 文件
 * @param {string} projectDir - 项目根目录
 * @param {string} filename - 文件名，格式 YYYY-MM-DD-HHmm.md
 * @param {string} content - 文件内容
 */
function createSessionFile(projectDir, filename, content) {
  const sessionsDir = path.join(projectDir, "memory-bank", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, filename), content);
}

// ==================== 退出码安全 ====================

describe("退出码安全", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectDir();
  });

  afterEach(() => {
    removeDirSync(tmpDir);
  });

  it("正常执行返回 exit code 0", () => {
    const { exitCode } = runHook(tmpDir);
    assert.equal(exitCode, 0, "SessionStart hook 不应阻止会话启动");
  });

  it("无 session 目录时返回 exit code 0", () => {
    // tmpDir 不含 memory-bank/sessions/
    const { exitCode } = runHook(tmpDir);
    assert.equal(exitCode, 0, "缺少 sessions 目录时不应崩溃");
  });

  it("无 CLAUDE.md 时返回 exit code 0", () => {
    const dirWithoutClaude = fs.mkdtempSync(
      path.join(os.tmpdir(), "session-check-noclaude-"),
    );
    try {
      const result = spawnSync("node", [HOOK_SCRIPT], {
        encoding: "utf8",
        timeout: 10000,
        cwd: dirWithoutClaude,
        env: process.env,
      });
      assert.equal(result.status, 0, "缺少 CLAUDE.md 时不应崩溃");
    } finally {
      removeDirSync(dirWithoutClaude);
    }
  });
});

// ==================== JSON 输出有效性 ====================

describe("JSON 输出有效性", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectDir();
  });

  afterEach(() => {
    removeDirSync(tmpDir);
  });

  it("stdout 输出有效 JSON", () => {
    const { stdout } = runHook(tmpDir);
    assert.ok(stdout.trim().length > 0, "stdout 不应为空");
    assert.doesNotThrow(() => {
      JSON.parse(stdout.trim());
    }, "stdout 必须是有效的 JSON");
  });

  it("无问题时输出空对象 {}", () => {
    // 无 session 目录、CLAUDE.md 正常大小 → 无问题
    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());
    // 无问题时输出 {} 或 { hookSpecificOutput: { additionalContext: "" } }
    // 脚本输出 {} 表示无内容
    assert.ok(
      typeof parsed === "object" && parsed !== null,
      "输出必须是 JSON 对象",
    );
  });
});

// ==================== session 恢复 ====================

describe("session 恢复", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectDir();
  });

  afterEach(() => {
    removeDirSync(tmpDir);
  });

  it("存在 session 文件时 additionalContext 包含 [Last Session]", () => {
    createSessionFile(
      tmpDir,
      "2026-03-04-1430.md",
      "## 会话摘要\n- 完成了用户认证模块\n- 修复了登录 bug",
    );

    const { stdout, exitCode } = runHook(tmpDir);
    assert.equal(exitCode, 0);

    const parsed = JSON.parse(stdout.trim());
    assert.ok(parsed.hookSpecificOutput, "应输出 hookSpecificOutput 字段");
    assert.ok(
      parsed.hookSpecificOutput.additionalContext,
      "应输出 additionalContext 字段",
    );
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("[Last Session]"),
      "additionalContext 应包含 [Last Session]",
    );
  });

  it("session 文件内容出现在 additionalContext 中", () => {
    const sessionContent = "## 昨日进度\n- 实现了 TDD 测试套件";
    createSessionFile(tmpDir, "2026-03-04-0900.md", sessionContent);

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());
    const context = parsed.hookSpecificOutput.additionalContext;

    assert.ok(
      context.includes("昨日进度"),
      "additionalContext 应包含 session 文件内容",
    );
  });

  it("多个 session 文件时只读取最新文件", () => {
    createSessionFile(tmpDir, "2026-03-01-1000.md", "## 旧 session\n- 旧内容");
    createSessionFile(
      tmpDir,
      "2026-03-04-1800.md",
      "## 最新 session\n- 最新内容",
    );
    createSessionFile(
      tmpDir,
      "2026-03-03-0800.md",
      "## 中间 session\n- 中间内容",
    );

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());
    const context = parsed.hookSpecificOutput.additionalContext;

    assert.ok(context.includes("最新内容"), "应读取最新的 session 文件");
    assert.ok(!context.includes("旧内容"), "不应包含旧 session 内容");
  });

  it("session 文件超过 500 字符时截断", () => {
    const longContent = "A".repeat(600);
    createSessionFile(tmpDir, "2026-03-04-1200.md", longContent);

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());
    const context = parsed.hookSpecificOutput.additionalContext;

    // 截断后应包含 "..."
    assert.ok(context.includes("..."), "超长 session 内容应被截断并附加 ...");
  });
});

// ==================== 无 session 目录时静默 ====================

describe("无 session 目录时静默", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectDir();
  });

  afterEach(() => {
    removeDirSync(tmpDir);
  });

  it("memory-bank/sessions/ 不存在时不报错", () => {
    // 确认 sessions 目录不存在
    const sessionsDir = path.join(tmpDir, "memory-bank", "sessions");
    assert.ok(!fs.existsSync(sessionsDir), "前置条件: sessions 目录不存在");

    const { exitCode, stderr } = runHook(tmpDir);
    assert.equal(exitCode, 0, "不应因缺少 sessions 目录而报错");
    assert.ok(!stderr.includes("Error"), "stderr 不应包含 Error");
    assert.ok(!stderr.includes("ENOENT"), "stderr 不应包含文件不存在错误");
  });

  it("memory-bank/ 存在但 sessions/ 不存在时不报错", () => {
    // 只创建 memory-bank，不创建 sessions 子目录
    fs.mkdirSync(path.join(tmpDir, "memory-bank"), { recursive: true });

    const { exitCode, stderr } = runHook(tmpDir);
    assert.equal(exitCode, 0);
    assert.ok(!stderr.includes("ENOENT"), "不应出现文件系统错误");
  });

  it("sessions/ 目录为空时输出不含 [Last Session]", () => {
    // 创建空 sessions 目录
    fs.mkdirSync(path.join(tmpDir, "memory-bank", "sessions"), {
      recursive: true,
    });

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());

    // 无 session 文件时，要么是 {} 要么 additionalContext 不含 [Last Session]
    const context = parsed.hookSpecificOutput?.additionalContext ?? "";
    assert.ok(
      !context.includes("[Last Session]"),
      "空 sessions 目录不应出现 [Last Session]",
    );
  });
});

// ==================== additionalContext 格式 ====================

describe("additionalContext 格式", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectDir();
  });

  afterEach(() => {
    removeDirSync(tmpDir);
  });

  it("有内容时输出符合 {hookSpecificOutput: {additionalContext: string}} 结构", () => {
    createSessionFile(
      tmpDir,
      "2026-03-05-1000.md",
      "## 测试 session\n- 验证格式",
    );

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());

    // 验证顶层结构
    assert.ok(
      Object.prototype.hasOwnProperty.call(parsed, "hookSpecificOutput"),
      "顶层应有 hookSpecificOutput 字段",
    );

    // 验证嵌套结构
    const hso = parsed.hookSpecificOutput;
    assert.equal(typeof hso, "object", "hookSpecificOutput 应为对象");
    assert.ok(
      Object.prototype.hasOwnProperty.call(hso, "additionalContext"),
      "hookSpecificOutput 应有 additionalContext 字段",
    );

    // 验证值类型
    assert.equal(
      typeof hso.additionalContext,
      "string",
      "additionalContext 应为字符串",
    );
    assert.ok(
      hso.additionalContext.length > 0,
      "additionalContext 不应为空字符串",
    );
  });

  it("additionalContext 以 [Last Session] 开头（当有 session 时）", () => {
    createSessionFile(
      tmpDir,
      "2026-03-05-0800.md",
      "## 会话记录\n- 测试格式验证",
    );

    const { stdout } = runHook(tmpDir);
    const parsed = JSON.parse(stdout.trim());
    const context = parsed.hookSpecificOutput.additionalContext;

    assert.ok(
      context.startsWith("[Last Session]"),
      "additionalContext 应以 [Last Session] 开头",
    );
  });

  it("无问题时 stdout 是有效 JSON 对象", () => {
    // 无 session 目录，CLAUDE.md 小于阈值
    const { stdout } = runHook(tmpDir);
    const trimmed = stdout.trim();

    assert.ok(trimmed.length > 0, "stdout 不应为空");
    const parsed = JSON.parse(trimmed);
    assert.equal(typeof parsed, "object", "输出必须是 JSON 对象");
    assert.ok(parsed !== null, "输出不应为 null");
  });
});

// ==================== --help 支持 ====================

describe("--help 模式", () => {
  it("--help 参数返回 exit code 0", () => {
    const result = spawnSync("node", [HOOK_SCRIPT, "--help"], {
      encoding: "utf8",
      timeout: 10000,
      cwd: os.tmpdir(),
      env: process.env,
    });
    assert.equal(result.status, 0, "--help 应返回 exit code 0");
  });

  it("--help 参数输出包含用途说明", () => {
    const result = spawnSync("node", [HOOK_SCRIPT, "--help"], {
      encoding: "utf8",
      timeout: 10000,
      cwd: os.tmpdir(),
      env: process.env,
    });
    assert.ok(
      result.stdout.includes("session-check.js"),
      "--help 输出应包含脚本名称",
    );
  });
});

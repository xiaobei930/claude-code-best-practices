#!/usr/bin/env node
/**
 * suggest-compact.js 单元测试
 *
 * 覆盖范围: 计数器逻辑、阈值边界、环境变量配置、session 隔离、退出码安全
 * 使用 node:test + node:assert（零依赖）
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const HOOK_SCRIPT = path.resolve(
  __dirname,
  "../../scripts/node/hooks/suggest-compact.js",
);

// ==================== 测试辅助 ====================

/**
 * 运行 hook 脚本并捕获输出
 * @param {object} options - { env: 环境变量覆盖 }
 * @returns {{ exitCode, stderr, stdout }}
 */
function runHook(options = {}) {
  const env = {
    ...process.env,
    // 使用唯一的 session ID 实现隔离
    CLAUDE_SESSION_ID:
      options.sessionId ||
      `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...options.env,
  };

  const result = spawnSync("node", [HOOK_SCRIPT], {
    encoding: "utf8",
    timeout: 10000,
    input: JSON.stringify({}), // 模拟 stdin
    env,
  });

  return {
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
  };
}

/**
 * 获取计数器文件路径
 */
function getCounterPath(sessionId) {
  return path.join(os.tmpdir(), `claude-tool-count-${sessionId}.txt`);
}

/**
 * 清理计数器文件
 */
function cleanupCounter(sessionId) {
  const counterPath = getCounterPath(sessionId);
  try {
    fs.unlinkSync(counterPath);
  } catch {
    // 忽略
  }
}

// ==================== 退出码安全 ====================

describe("退出码安全", () => {
  it("正常执行返回 exit code 0", () => {
    const { exitCode } = runHook();
    assert.equal(exitCode, 0, "Hook 不应阻止操作");
  });

  it("无 stdin 输入时返回 exit code 0", () => {
    const result = spawnSync("node", [HOOK_SCRIPT], {
      encoding: "utf8",
      timeout: 10000,
      input: "",
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: `empty-stdin-${Date.now()}`,
      },
    });
    assert.equal(result.status, 0, "无输入时不应崩溃");
  });
});

// ==================== 计数器逻辑 ====================

describe("计数器逻辑", () => {
  let sessionId;

  beforeEach(() => {
    sessionId = `counter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    cleanupCounter(sessionId);
  });

  it("首次调用计数为 1", () => {
    runHook({ sessionId });
    const counterPath = getCounterPath(sessionId);
    assert.ok(fs.existsSync(counterPath), "计数器文件应被创建");
    const count = parseInt(fs.readFileSync(counterPath, "utf8"), 10);
    assert.equal(count, 1);
  });

  it("多次调用递增计数", () => {
    runHook({ sessionId });
    runHook({ sessionId });
    runHook({ sessionId });
    const count = parseInt(
      fs.readFileSync(getCounterPath(sessionId), "utf8"),
      10,
    );
    assert.equal(count, 3);
  });
});

// ==================== 阈值和提醒 ====================

describe("阈值和提醒", () => {
  let sessionId;

  beforeEach(() => {
    sessionId = `threshold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    cleanupCounter(sessionId);
  });

  it("阈值前无提醒", () => {
    // 设置阈值为 5 以便快速测试
    const { stderr } = runHook({
      sessionId,
      env: { COMPACT_THRESHOLD: "5", COMPACT_INTERVAL: "3" },
    });
    assert.ok(!stderr.includes("[CompactReminder]"), "阈值前不应有提醒");
  });

  it("达到阈值时触发提醒", () => {
    // 预设计数器到阈值-1
    fs.writeFileSync(getCounterPath(sessionId), "4");
    const { stderr } = runHook({
      sessionId,
      env: { COMPACT_THRESHOLD: "5", COMPACT_INTERVAL: "3" },
    });
    assert.ok(stderr.includes("[CompactReminder]"), "达到阈值应触发提醒");
    assert.ok(stderr.includes("5"), "提醒应包含调用次数");
  });

  it("超过阈值后按间隔提醒", () => {
    // 阈值=5, 间隔=3 → 在 5, 8, 11... 时提醒
    // 设置计数器到 7（阈值+间隔-1）
    fs.writeFileSync(getCounterPath(sessionId), "7");
    const { stderr } = runHook({
      sessionId,
      env: { COMPACT_THRESHOLD: "5", COMPACT_INTERVAL: "3" },
    });
    // count=8, (8-5)%3 === 0 → 应该提醒
    assert.ok(stderr.includes("[CompactReminder]"), "间隔到达时应提醒");
  });

  it("非间隔点不提醒", () => {
    // 设置计数器到 5（阈值后第1次，间隔=3，不是提醒点）
    fs.writeFileSync(getCounterPath(sessionId), "5");
    const { stderr } = runHook({
      sessionId,
      env: { COMPACT_THRESHOLD: "5", COMPACT_INTERVAL: "3" },
    });
    // count=6, (6-5)%3 === 1 → 不应该提醒
    assert.ok(!stderr.includes("[CompactReminder]"), "非间隔点不应提醒");
  });
});

// ==================== 环境变量边界 ====================

describe("环境变量配置", () => {
  it("自定义 COMPACT_THRESHOLD 生效", () => {
    const sessionId = `env-threshold-${Date.now()}`;
    fs.writeFileSync(getCounterPath(sessionId), "9");
    try {
      const { stderr } = runHook({
        sessionId,
        env: { COMPACT_THRESHOLD: "10" },
      });
      assert.ok(stderr.includes("[CompactReminder]"), "自定义阈值应生效");
    } finally {
      cleanupCounter(sessionId);
    }
  });

  it("无效 COMPACT_THRESHOLD 回退到默认值", () => {
    const sessionId = `env-invalid-${Date.now()}`;
    try {
      const { exitCode } = runHook({
        sessionId,
        env: { COMPACT_THRESHOLD: "not-a-number" },
      });
      assert.equal(exitCode, 0, "无效配置不应导致崩溃");
    } finally {
      cleanupCounter(sessionId);
    }
  });
});

// ==================== Session 隔离 ====================

describe("Session 隔离", () => {
  it("不同 session 使用不同计数器", () => {
    const session1 = `isolation-1-${Date.now()}`;
    const session2 = `isolation-2-${Date.now()}`;

    try {
      // session1 调用 3 次
      runHook({ sessionId: session1 });
      runHook({ sessionId: session1 });
      runHook({ sessionId: session1 });

      // session2 调用 1 次
      runHook({ sessionId: session2 });

      const count1 = parseInt(
        fs.readFileSync(getCounterPath(session1), "utf8"),
        10,
      );
      const count2 = parseInt(
        fs.readFileSync(getCounterPath(session2), "utf8"),
        10,
      );

      assert.equal(count1, 3, "session1 计数应为 3");
      assert.equal(count2, 1, "session2 计数应为 1");
    } finally {
      cleanupCounter(session1);
      cleanupCounter(session2);
    }
  });
});

// ==================== 破损计数器恢复 ====================

describe("破损计数器恢复", () => {
  it("计数器文件内容非数字时正常处理", () => {
    const sessionId = `corrupt-${Date.now()}`;
    fs.writeFileSync(getCounterPath(sessionId), "corrupted-data");

    try {
      const { exitCode } = runHook({ sessionId });
      assert.equal(exitCode, 0, "破损计数器不应导致崩溃");

      // NaN || 0 → 0, 然后 +1 = 1
      const count = parseInt(
        fs.readFileSync(getCounterPath(sessionId), "utf8"),
        10,
      );
      assert.equal(count, 1, "破损后应重置为 1");
    } finally {
      cleanupCounter(sessionId);
    }
  });
});

// ==================== 高频提醒 ====================

describe("高频提醒", () => {
  it("达到 2 倍阈值时触发高频提醒", () => {
    const sessionId = `highfreq-${Date.now()}`;
    // 阈值=5, 2倍=10, 设置计数器到 9
    fs.writeFileSync(getCounterPath(sessionId), "9");

    try {
      const { stderr } = runHook({
        sessionId,
        env: { COMPACT_THRESHOLD: "5" },
      });
      // count=10, >= 5*2, (10-10)%10 === 0 → 高频提醒
      assert.ok(stderr.includes("🔴"), "2 倍阈值应触发高频提醒");
    } finally {
      cleanupCounter(sessionId);
    }
  });
});

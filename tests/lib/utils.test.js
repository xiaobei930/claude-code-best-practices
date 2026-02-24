#!/usr/bin/env node
/**
 * utils.js 单元测试
 *
 * 覆盖范围: 路径工具、会话管理、日期时间、文件操作、文本处理
 * 使用 node:test + node:assert（零依赖）
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 被测模块
const utils = require("../../scripts/node/lib/utils");

// ==================== 测试辅助 ====================

/** 创建隔离的临时目录 */
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ccbest-test-${Date.now()}-`));
}

/** 清理临时目录 */
function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

// ==================== 平台检测 ====================

describe("平台检测", () => {
  it("应返回正确的平台标识", () => {
    // 至少有一个平台标识为 true
    const platformCount = [
      utils.isWindows,
      utils.isMacOS,
      utils.isLinux,
    ].filter(Boolean).length;
    assert.ok(platformCount >= 1, "至少一个平台标识为 true");
  });

  it("平台标识类型为 boolean", () => {
    assert.equal(typeof utils.isWindows, "boolean");
    assert.equal(typeof utils.isMacOS, "boolean");
    assert.equal(typeof utils.isLinux, "boolean");
  });
});

// ==================== 路径工具 ====================

describe("路径工具", () => {
  it("getHomeDir 返回非空字符串", () => {
    const home = utils.getHomeDir();
    assert.ok(typeof home === "string" && home.length > 0);
  });

  it("getClaudeDir 返回 ~/.claude 路径", () => {
    const claudeDir = utils.getClaudeDir();
    assert.ok(claudeDir.endsWith(".claude"));
    assert.ok(claudeDir.includes(os.homedir()));
  });

  it("getProjectClaudeDir 使用指定目录", () => {
    const dir = utils.getProjectClaudeDir("/tmp/test-project");
    assert.ok(dir.endsWith(".claude"));
    assert.ok(dir.includes("test-project"));
  });

  it("getMemoryBankDir 使用指定目录", () => {
    const dir = utils.getMemoryBankDir("/tmp/test-project");
    assert.ok(dir.endsWith("memory-bank"));
  });

  it("getTempDir 返回有效目录", () => {
    const tmp = utils.getTempDir();
    assert.ok(fs.existsSync(tmp), "临时目录应存在");
  });

  it("ensureDir 创建不存在的目录", () => {
    const tempDir = createTempDir();
    try {
      const newDir = path.join(tempDir, "a", "b", "c");
      assert.ok(!fs.existsSync(newDir));
      utils.ensureDir(newDir);
      assert.ok(fs.existsSync(newDir), "目录应被递归创建");
    } finally {
      removeTempDir(tempDir);
    }
  });

  it("ensureDir 对已存在的目录无影响", () => {
    const tempDir = createTempDir();
    try {
      utils.ensureDir(tempDir); // 不应抛异常
      assert.ok(fs.existsSync(tempDir));
    } finally {
      removeTempDir(tempDir);
    }
  });
});

// ==================== 会话管理 ====================

describe("会话管理", () => {
  const originalEnv = process.env.CLAUDE_SESSION_ID;

  after(() => {
    // 恢复环境变量
    if (originalEnv !== undefined) {
      process.env.CLAUDE_SESSION_ID = originalEnv;
    } else {
      delete process.env.CLAUDE_SESSION_ID;
    }
  });

  it("getSessionId 无环境变量时返回 fallback", () => {
    delete process.env.CLAUDE_SESSION_ID;
    assert.equal(utils.getSessionId("fallback"), "fallback");
  });

  it("getSessionId 有环境变量时返回 session ID", () => {
    process.env.CLAUDE_SESSION_ID = "test-session-12345678";
    assert.equal(utils.getSessionId(), "test-session-12345678");
  });

  it("getSessionId 空字符串时返回 fallback", () => {
    process.env.CLAUDE_SESSION_ID = "";
    assert.equal(utils.getSessionId("default"), "default");
  });

  it("getSessionIdShort 返回后 8 位", () => {
    process.env.CLAUDE_SESSION_ID = "abcdefgh-ijkl-mnop-qrst-uvwxyz123456";
    assert.equal(utils.getSessionIdShort(), "yz123456");
  });

  it("getSessionIdShort 无环境变量时返回 fallback", () => {
    delete process.env.CLAUDE_SESSION_ID;
    assert.equal(utils.getSessionIdShort("none"), "none");
  });

  it("getSessionFileName 生成带 session ID 的文件名", () => {
    process.env.CLAUDE_SESSION_ID = "test-session-abcd1234";
    const name = utils.getSessionFileName("progress", "md");
    assert.equal(name, "progress-abcd1234.md");
  });

  it("getSessionFileName 无 session 时不带后缀", () => {
    delete process.env.CLAUDE_SESSION_ID;
    const name = utils.getSessionFileName("progress", "md");
    assert.equal(name, "progress.md");
  });
});

// ==================== 日期时间 ====================

describe("日期时间", () => {
  it("getDateString 返回 YYYY-MM-DD 格式", () => {
    const date = utils.getDateString();
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("getTimeString 返回 HH:MM 格式", () => {
    const time = utils.getTimeString();
    assert.match(time, /^\d{2}:\d{2}$/);
  });

  it("getDateTimeString 返回 YYYY-MM-DD HH:MM:SS 格式", () => {
    const dt = utils.getDateTimeString();
    assert.match(dt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

// ==================== 文件操作 ====================

describe("文件操作", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  after(() => {
    if (tempDir) removeTempDir(tempDir);
  });

  it("writeFile + readFile 正常读写", () => {
    const filePath = path.join(tempDir, "test.txt");
    utils.writeFile(filePath, "hello world");
    assert.equal(utils.readFile(filePath), "hello world");
  });

  it("writeFile 自动创建父目录", () => {
    const filePath = path.join(tempDir, "deep", "nested", "file.txt");
    utils.writeFile(filePath, "content");
    assert.ok(fs.existsSync(filePath));
    assert.equal(utils.readFile(filePath), "content");
  });

  it("readFile 不存在的文件返回 null", () => {
    assert.equal(utils.readFile(path.join(tempDir, "nonexistent.txt")), null);
  });

  it("writeJsonFile + readJsonFile 正常读写 JSON", () => {
    const filePath = path.join(tempDir, "data.json");
    const data = { name: "test", value: 42, nested: { a: true } };
    utils.writeJsonFile(filePath, data);
    assert.deepEqual(utils.readJsonFile(filePath), data);
  });

  it("readJsonFile 无效 JSON 返回 null", () => {
    const filePath = path.join(tempDir, "bad.json");
    utils.writeFile(filePath, "not json {{{");
    assert.equal(utils.readJsonFile(filePath), null);
  });

  it("appendFile 追加内容", () => {
    const filePath = path.join(tempDir, "append.txt");
    utils.writeFile(filePath, "line1\n");
    utils.appendFile(filePath, "line2\n");
    assert.equal(utils.readFile(filePath), "line1\nline2\n");
  });

  it("fileExists 正确检测文件存在性", () => {
    const filePath = path.join(tempDir, "exists.txt");
    assert.equal(utils.fileExists(filePath), false);
    utils.writeFile(filePath, "");
    assert.equal(utils.fileExists(filePath), true);
  });

  it("findFiles 搜索匹配文件", () => {
    utils.writeFile(path.join(tempDir, "a.md"), "# A");
    utils.writeFile(path.join(tempDir, "b.md"), "# B");
    utils.writeFile(path.join(tempDir, "c.txt"), "C");

    const mdFiles = utils.findFiles(tempDir, "*.md");
    assert.equal(mdFiles.length, 2);
    assert.ok(mdFiles.every((f) => f.path.endsWith(".md")));
  });

  it("findFiles 递归搜索", () => {
    utils.writeFile(path.join(tempDir, "top.js"), "");
    utils.writeFile(path.join(tempDir, "sub", "nested.js"), "");

    const nonRecursive = utils.findFiles(tempDir, "*.js", { recursive: false });
    assert.equal(nonRecursive.length, 1);

    const recursive = utils.findFiles(tempDir, "*.js", { recursive: true });
    assert.equal(recursive.length, 2);
  });

  it("findFiles 不存在的目录返回空数组", () => {
    const result = utils.findFiles(path.join(tempDir, "nonexistent"), "*.md");
    assert.deepEqual(result, []);
  });
});

// ==================== 系统命令 ====================

describe("系统命令", () => {
  it("commandExists 检测 node 命令", () => {
    assert.equal(utils.commandExists("node"), true);
  });

  it("commandExists 不存在的命令返回 false", () => {
    assert.equal(utils.commandExists("nonexistent-cmd-xyz123"), false);
  });

  it("commandExists 拒绝非法字符", () => {
    assert.equal(utils.commandExists("rm -rf /"), false);
    assert.equal(utils.commandExists("cmd; echo hack"), false);
  });

  it("runCommand 执行成功返回 success", () => {
    const result = utils.runCommand("node --version");
    assert.equal(result.success, true);
    assert.ok(result.output.startsWith("v"));
  });

  it("runCommand 执行失败返回 failure", () => {
    const result = utils.runCommand('node -e "process.exit(1)"');
    assert.equal(result.success, false);
  });
});

// ==================== 文本处理 ====================

describe("文本处理", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  after(() => {
    if (tempDir) removeTempDir(tempDir);
  });

  it("grepFile 找到匹配行", () => {
    const filePath = path.join(tempDir, "test.txt");
    utils.writeFile(
      filePath,
      "line one\nTODO: fix this\nline three\nTODO: another",
    );

    const results = utils.grepFile(filePath, /TODO/);
    assert.equal(results.length, 2);
    assert.equal(results[0].lineNumber, 2);
    assert.ok(results[0].content.includes("TODO: fix this"));
  });

  it("grepFile 无匹配返回空数组", () => {
    const filePath = path.join(tempDir, "clean.txt");
    utils.writeFile(filePath, "clean code\nno issues");

    const results = utils.grepFile(filePath, /TODO/);
    assert.deepEqual(results, []);
  });

  it("grepFile 文件不存在返回空数组", () => {
    const results = utils.grepFile(path.join(tempDir, "missing.txt"), /TODO/);
    assert.deepEqual(results, []);
  });

  it("countInFile 统计匹配数量", () => {
    const filePath = path.join(tempDir, "count.txt");
    utils.writeFile(filePath, "TODO one\nTODO two\nFIXME three\nTODO four");

    assert.equal(utils.countInFile(filePath, /TODO/g), 3);
    assert.equal(utils.countInFile(filePath, /FIXME/g), 1);
    assert.equal(utils.countInFile(filePath, /HACK/g), 0);
  });

  it("countInFile 文件不存在返回 0", () => {
    assert.equal(
      utils.countInFile(path.join(tempDir, "missing.txt"), /TODO/g),
      0,
    );
  });
});

// ==================== Hook I/O ====================

describe("Hook I/O", () => {
  it("log 输出到 stderr", () => {
    // log 函数使用 console.error，不抛异常即为通过
    utils.log("test message");
  });

  it("output 处理字符串输入", () => {
    // output 使用 console.log，测试不抛异常
    utils.output("test string");
  });

  it("output 处理对象输入", () => {
    utils.output({ key: "value" });
  });
});

// ==================== 导出完整性 ====================

describe("导出完整性", () => {
  const expectedExports = [
    // 平台
    "isWindows",
    "isMacOS",
    "isLinux",
    // 路径
    "getHomeDir",
    "getClaudeDir",
    "getProjectClaudeDir",
    "getMemoryBankDir",
    "getTempDir",
    "ensureDir",
    // 会话
    "getSessionId",
    "getSessionIdShort",
    "getSessionFileName",
    // 日期
    "getDateString",
    "getTimeString",
    "getDateTimeString",
    // 文件
    "readFile",
    "readJsonFile",
    "writeFile",
    "writeJsonFile",
    "appendFile",
    "fileExists",
    "findFiles",
    // Hook I/O
    "readStdinJson",
    "log",
    "output",
    // 系统
    "commandExists",
    "runCommand",
    "isGitRepo",
    "getGitModifiedFiles",
    "getGitBranch",
    // 文本
    "grepFile",
    "countInFile",
  ];

  for (const name of expectedExports) {
    it(`导出 ${name}`, () => {
      assert.ok(name in utils, `缺少导出: ${name}`);
    });
  }
});

/**
 * session-aliases 功能测试
 *
 * 测试 utils.js 中会话别名相关函数：
 * - loadSessionAliases / saveSessionAlias / findSessionByAlias / inferTags
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 创建隔离的临时目录模拟 ~/.claude
const tmpBase = path.join(os.tmpdir(), `cc-best-alias-test-${Date.now()}`);
const fakeClaudeDir = path.join(tmpBase, ".claude");

// 在 require 前 mock 环境
fs.mkdirSync(fakeClaudeDir, { recursive: true });

// 动态替换 getClaudeDir 的返回值
const utils = require("../../scripts/node/lib/utils");
const originalGetClaudeDir = utils.getClaudeDir;

describe("session-aliases", () => {
  beforeEach(() => {
    // 替换 getClaudeDir 指向临时目录
    utils.getClaudeDir = () => fakeClaudeDir;

    // 清理别名文件
    const aliasPath = path.join(fakeClaudeDir, "session-aliases.json");
    if (fs.existsSync(aliasPath)) {
      fs.unlinkSync(aliasPath);
    }
  });

  afterEach(() => {
    utils.getClaudeDir = originalGetClaudeDir;
  });

  describe("inferTags", () => {
    it("should infer feature tag from feature- prefix", () => {
      const tags = utils.inferTags("feature-login-page");
      assert.deepStrictEqual(tags, ["feature"]);
    });

    it("should infer bugfix tag from bugfix- prefix", () => {
      const tags = utils.inferTags("bugfix-auth-timeout");
      assert.deepStrictEqual(tags, ["bugfix"]);
    });

    it("should infer bugfix tag from fix- prefix", () => {
      const tags = utils.inferTags("fix-memory-leak");
      assert.deepStrictEqual(tags, ["bugfix"]);
    });

    it("should infer refactor tag", () => {
      const tags = utils.inferTags("refactor-api-layer");
      assert.deepStrictEqual(tags, ["refactor"]);
    });

    it("should infer explore tag", () => {
      const tags = utils.inferTags("explore-new-framework");
      assert.deepStrictEqual(tags, ["explore"]);
    });

    it("should infer hotfix tag", () => {
      const tags = utils.inferTags("hotfix-critical-bug");
      assert.deepStrictEqual(tags, ["hotfix"]);
    });

    it("should return empty tags for unknown prefix", () => {
      const tags = utils.inferTags("random-task-name");
      assert.deepStrictEqual(tags, []);
    });
  });

  describe("loadSessionAliases", () => {
    it("should return empty array when no file exists", () => {
      const aliases = utils.loadSessionAliases();
      assert.deepStrictEqual(aliases, []);
    });

    it("should load existing aliases from file", () => {
      const aliasPath = path.join(fakeClaudeDir, "session-aliases.json");
      const data = [{ name: "test-alias", tags: ["feature"] }];
      fs.writeFileSync(aliasPath, JSON.stringify(data), "utf8");

      const aliases = utils.loadSessionAliases();
      assert.equal(aliases.length, 1);
      assert.equal(aliases[0].name, "test-alias");
    });
  });

  describe("saveSessionAlias", () => {
    it("should create new alias", () => {
      const entry = utils.saveSessionAlias("feature-test", {
        summary: "测试会话",
      });

      assert.equal(entry.name, "feature-test");
      assert.equal(entry.summary, "测试会话");
      assert.deepStrictEqual(entry.tags, ["feature"]);
      assert.ok(entry.created);
      assert.equal(entry.sessionPath, "memory-bank/progress.md");

      // 验证持久化
      const aliases = utils.loadSessionAliases();
      assert.equal(aliases.length, 1);
    });

    it("should update existing alias", () => {
      utils.saveSessionAlias("feature-test", { summary: "v1" });
      utils.saveSessionAlias("feature-test", { summary: "v2" });

      const aliases = utils.loadSessionAliases();
      assert.equal(aliases.length, 1);
      assert.equal(aliases[0].summary, "v2");
    });

    it("should support custom tags", () => {
      const entry = utils.saveSessionAlias("my-task", {
        tags: ["custom", "special"],
      });

      assert.deepStrictEqual(entry.tags, ["custom", "special"]);
    });

    it("should handle multiple aliases", () => {
      utils.saveSessionAlias("feature-a", { summary: "A" });
      utils.saveSessionAlias("bugfix-b", { summary: "B" });
      utils.saveSessionAlias("refactor-c", { summary: "C" });

      const aliases = utils.loadSessionAliases();
      assert.equal(aliases.length, 3);
    });
  });

  describe("findSessionByAlias", () => {
    beforeEach(() => {
      utils.saveSessionAlias("feature-login", { summary: "登录功能" });
      utils.saveSessionAlias("bugfix-auth", {
        summary: "认证修复",
        tags: ["bugfix", "security"],
      });
      utils.saveSessionAlias("refactor-api", { summary: "API重构" });
    });

    it("should find by exact name", () => {
      const result = utils.findSessionByAlias("feature-login");
      assert.ok(result);
      assert.equal(result.name, "feature-login");
    });

    it("should find by partial name (unique match)", () => {
      const result = utils.findSessionByAlias("login");
      assert.ok(result);
      assert.equal(result.name, "feature-login");
    });

    it("should find by tag match (unique)", () => {
      const result = utils.findSessionByAlias("security");
      assert.ok(result);
      assert.equal(result.name, "bugfix-auth");
    });

    it("should return null for ambiguous match", () => {
      // "feature" and "refactor" both contain partial matches for different entries
      // but "bugfix" + "feature" + "refactor" all include "-" — let's use a query that matches multiple
      const result = utils.findSessionByAlias("re");
      // "refactor-api" contains "re", "feature-login" contains "re" — ambiguous
      assert.equal(result, null);
    });

    it("should return null for no match", () => {
      const result = utils.findSessionByAlias("nonexistent-xyz");
      assert.equal(result, null);
    });
  });
});

// 清理临时目录
process.on("exit", () => {
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

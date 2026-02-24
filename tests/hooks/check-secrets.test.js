#!/usr/bin/env node
/**
 * check-secrets.js 单元测试
 *
 * 覆盖范围: 密钥模式匹配、文件过滤逻辑、退出码安全、--help 标志
 * 使用 node:test + node:assert（零依赖）
 *
 * 测试策略:
 * - 脚本内部函数未导出，通过子进程测试整体行为
 * - 密钥正则和文件过滤逻辑在测试中独立复现验证
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const HOOK_SCRIPT = path.resolve(
  __dirname,
  "../../scripts/node/hooks/check-secrets.js",
);

// ==================== 测试辅助 ====================

/**
 * 运行 hook 脚本并捕获输出
 * @param {string} stdinData - stdin 输入（JSON 字符串）
 * @param {string[]} args - 命令行参数
 * @returns {{ exitCode, stderr, stdout }}
 */
function runHook(stdinData = "{}", args = []) {
  const result = spawnSync("node", [HOOK_SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 10000,
    input: stdinData,
    env: { ...process.env },
  });

  return {
    exitCode: result.status,
    stderr: result.stderr || "",
    stdout: result.stdout || "",
  };
}

// ==================== 退出码安全 ====================

describe("退出码安全", () => {
  it("空 stdin 返回 exit code 0", () => {
    const { exitCode } = runHook("");
    assert.equal(exitCode, 0, "空输入不应崩溃");
  });

  it("无效 JSON 输入返回 exit code 0", () => {
    const { exitCode } = runHook("not valid json {{{}}}");
    assert.equal(exitCode, 0, "无效 JSON 不应崩溃");
  });

  it("空对象输入返回 exit code 0", () => {
    const { exitCode } = runHook(JSON.stringify({}));
    assert.equal(exitCode, 0, "空对象不应崩溃");
  });

  it("非 Bash 工具调用静默跳过", () => {
    const input = {
      tool_name: "Read",
      tool_input: { file_path: "/some/file.js" },
    };
    const { exitCode, stderr } = runHook(JSON.stringify(input));
    assert.equal(exitCode, 0);
    assert.ok(!stderr.includes("密钥泄露"), "非 Bash 工具不应触发检测");
  });

  it("Bash 非 git-commit 命令静默跳过", () => {
    const input = {
      tool_name: "Bash",
      tool_input: { command: "npm install" },
    };
    const { exitCode, stderr } = runHook(JSON.stringify(input));
    assert.equal(exitCode, 0);
    assert.ok(!stderr.includes("密钥泄露"), "非 git commit 不应触发检测");
  });
});

// ==================== --help 标志 ====================

describe("--help 标志", () => {
  it("--help 返回帮助信息并退出 0", () => {
    const { exitCode, stdout } = runHook("{}", ["--help"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("check-secrets.js"), "应包含脚本名");
    assert.ok(stdout.includes("密钥泄露检测"), "应包含功能描述");
    assert.ok(stdout.includes("30+"), "应提到检测范围");
  });
});

// ==================== 密钥模式匹配 ====================

// 从 check-secrets.js 复现核心正则模式用于独立验证
const SECRET_PATTERNS = [
  {
    provider: "Anthropic",
    pattern: /sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}/g,
    validSamples: [
      `sk-ant-api03-${"A".repeat(80)}`,
      `sk-ant-api01-${"Bc9_-".repeat(16)}`,
    ],
    invalidSamples: ["sk-ant-api-short", "sk-ant-apix1-" + "A".repeat(80)],
  },
  {
    provider: "OpenAI",
    pattern: /sk-[A-Za-z0-9]{32,}/g,
    validSamples: [`sk-${"A".repeat(32)}`, `sk-${"aB3x".repeat(10)}`],
    invalidSamples: ["sk-short", "sk-" + "A".repeat(10)],
  },
  {
    provider: "AWS",
    pattern: /AKIA[0-9A-Z]{16}/g,
    validSamples: ["AKIAIOSFODNN7EXAMPLE"],
    invalidSamples: ["AKIA12345", "AKIAlowercase1234567"],
  },
  {
    provider: "Google Cloud",
    pattern: /AIza[A-Za-z0-9_-]{35}/g,
    validSamples: [`AIza${"A".repeat(35)}`],
    invalidSamples: ["AIza" + "A".repeat(10)],
  },
  {
    provider: "Stripe",
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
    validSamples: [`sk_live_${"A".repeat(24)}`],
    invalidSamples: ["sk_live_short", "sk_test_" + "A".repeat(24)],
  },
  {
    provider: "GitHub",
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    validSamples: [`ghp_${"A".repeat(36)}`],
    invalidSamples: ["ghp_short", "ghp_" + "A".repeat(10)],
  },
  {
    provider: "GitLab",
    pattern: /glpat-[A-Za-z0-9_-]{20,}/g,
    validSamples: [`glpat-${"A".repeat(20)}`],
    invalidSamples: ["glpat-short"],
  },
  {
    provider: "Slack",
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    validSamples: ["xoxb-1234567890", "xoxp-abcdefghij"],
    invalidSamples: ["xoxz-1234567890", "xoxb-short"],
  },
  {
    provider: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    validSamples: [
      "-----BEGIN PRIVATE KEY-----",
      "-----BEGIN RSA PRIVATE KEY-----",
      "-----BEGIN EC PRIVATE KEY-----",
      "-----BEGIN OPENSSH PRIVATE KEY-----",
    ],
    invalidSamples: [
      "-----BEGIN PUBLIC KEY-----",
      "-----BEGIN CERTIFICATE-----",
    ],
  },
  {
    provider: "MongoDB",
    pattern: /mongodb\+srv:\/\/[^:]+:[^@]+@/g,
    validSamples: ["mongodb+srv://user:password@cluster.mongodb.net"],
    invalidSamples: ["mongodb+srv://cluster.mongodb.net"],
  },
  {
    provider: "SendGrid",
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    validSamples: [`SG.${"A".repeat(22)}.${"B".repeat(43)}`],
    invalidSamples: ["SG.short.key"],
  },
  {
    provider: "HuggingFace",
    pattern: /hf_[A-Za-z0-9]{30,}/g,
    validSamples: [`hf_${"A".repeat(30)}`],
    invalidSamples: ["hf_short"],
  },
  {
    provider: "npm",
    pattern: /npm_[A-Za-z0-9]{36}/g,
    validSamples: [`npm_${"A".repeat(36)}`],
    invalidSamples: ["npm_short"],
  },
];

describe("密钥模式匹配", () => {
  for (const {
    provider,
    pattern,
    validSamples,
    invalidSamples,
  } of SECRET_PATTERNS) {
    describe(`${provider} 模式`, () => {
      for (const sample of validSamples) {
        it(`匹配有效密钥: ${sample.slice(0, 40)}...`, () => {
          pattern.lastIndex = 0;
          assert.ok(pattern.test(sample), `应匹配 ${provider} 密钥`);
        });
      }

      for (const sample of invalidSamples) {
        it(`拒绝无效输入: ${sample.slice(0, 40)}...`, () => {
          pattern.lastIndex = 0;
          assert.ok(!pattern.test(sample), `不应匹配: ${sample}`);
        });
      }
    });
  }
});

// ==================== 文件过滤逻辑 ====================

// 复现 shouldCheckFile 逻辑用于独立验证
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /\.env\.example/,
  /\.env\.sample/,
  /\.env\.template/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
  /\.test\.(js|ts)/,
  /\.spec\.(js|ts)/,
  /__tests__/,
  /\.md$/,
  /CHANGELOG/,
  /README/,
];

const CHECK_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".py",
  ".go",
  ".java",
  ".cs",
  ".rb",
  ".php",
  ".sh",
  ".bash",
  ".zsh",
  ".config",
];

function shouldCheckFile(filePath) {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  return CHECK_EXTENSIONS.includes(ext) || filePath.includes(".env");
}

describe("文件过滤逻辑", () => {
  describe("应检查的文件", () => {
    const checkTargets = [
      "src/config.js",
      "lib/api.ts",
      "app/page.tsx",
      "server.py",
      "main.go",
      "config.yaml",
      "settings.yml",
      "deploy.sh",
      ".env",
      ".env.local",
      ".env.production",
      "config.json",
    ];

    for (const file of checkTargets) {
      it(`检查 ${file}`, () => {
        assert.ok(shouldCheckFile(file), `应检查 ${file}`);
      });
    }
  });

  describe("应排除的文件", () => {
    const excludeTargets = [
      "node_modules/package/index.js",
      ".git/config",
      ".env.example",
      ".env.sample",
      ".env.template",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "utils.test.js",
      "api.spec.ts",
      "__tests__/helper.js",
      "README.md",
      "CHANGELOG.md",
      "docs/guide.md",
    ];

    for (const file of excludeTargets) {
      it(`排除 ${file}`, () => {
        assert.ok(!shouldCheckFile(file), `应排除 ${file}`);
      });
    }
  });

  describe("无关扩展名排除", () => {
    const nonCheckTargets = [
      "image.png",
      "style.css",
      "font.woff2",
      "binary.exe",
      "document.pdf",
    ];

    for (const file of nonCheckTargets) {
      it(`忽略 ${file}`, () => {
        assert.ok(!shouldCheckFile(file), `应忽略 ${file}`);
      });
    }
  });
});

// ==================== 注释行跳过逻辑 ====================

describe("注释行跳过", () => {
  // 复现 scanForSecrets 的注释跳过逻辑
  function isCommentLine(line) {
    const trimmed = line.trim();
    return (
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("*")
    );
  }

  it("跳过 // 注释", () => {
    assert.ok(isCommentLine("  // sk-ant-api03-" + "A".repeat(80)));
  });

  it("跳过 # 注释", () => {
    assert.ok(isCommentLine("# AKIA" + "A".repeat(16)));
  });

  it("跳过 * 注释", () => {
    assert.ok(isCommentLine(" * ghp_" + "A".repeat(36)));
  });

  it("不跳过正常代码", () => {
    assert.ok(
      !isCommentLine('const key = "sk-ant-api03-' + "A".repeat(80) + '"'),
    );
  });

  it("不跳过空行", () => {
    assert.ok(!isCommentLine(""));
  });
});

// ==================== 脱敏逻辑 ====================

describe("脱敏显示", () => {
  // 复现 masking 逻辑
  function maskSecret(match) {
    return (
      match.substring(0, 4) +
      "*".repeat(Math.min(20, match.length - 8)) +
      match.substring(match.length - 4)
    );
  }

  it("长密钥保留前4后4中间脱敏", () => {
    const secret = "sk-ant-api03-" + "A".repeat(80);
    const masked = maskSecret(secret);
    assert.ok(masked.startsWith("sk-a"), "应保留前4位");
    assert.ok(masked.endsWith("AAAA"), "应保留后4位");
    assert.ok(masked.includes("*"), "中间应有星号");
  });

  it("短密钥也不崩溃", () => {
    const secret = "AKIAIOSFODNN7EXAMPLE";
    const masked = maskSecret(secret);
    assert.ok(masked.startsWith("AKIA"), "应保留前4位");
    assert.ok(typeof masked === "string");
  });

  it("脱敏后长度合理", () => {
    const secret = `ghp_${"A".repeat(36)}`;
    const masked = maskSecret(secret);
    // 前4 + min(20, 40-8)=20 + 后4 = 28
    assert.equal(masked.length, 28);
  });
});

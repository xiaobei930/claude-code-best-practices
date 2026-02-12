#!/usr/bin/env node
/**
 * CI 验证脚本: 配置安全扫描
 *
 * 对插件配置文件执行 8 类安全检查。
 * 可通过 validate-all.js 集成到 CI 流程。
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 退出码:
 * - 0: 扫描通过（无 CRITICAL）
 * - 1: 扫描失败（存在 CRITICAL）
 */

const fs = require("fs");
const path = require("path");

// 插件根目录
const PLUGIN_ROOT = path.resolve(__dirname, "../..");

// ==================== 严重性定义 ====================

const SEVERITY = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "INFO",
};

const SEVERITY_ICONS = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
  INFO: "ℹ️ ",
};

// ==================== 工具函数 ====================

/**
 * 安全读取文件
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * 安全解析 JSON
 */
function safeParseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 递归获取目录下的文件
 */
function getFiles(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...getFiles(fullPath, pattern));
    } else if (pattern.test(item.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ==================== 扫描器 ====================

const findings = [];

/**
 * 添加发现
 */
function addFinding(severity, category, file, message) {
  findings.push({
    severity,
    category,
    file: path.relative(PLUGIN_ROOT, file),
    message,
  });
}

/**
 * 1. Hook 命令注入检查
 */
function checkHookInjection() {
  const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
  const content = safeReadFile(hooksPath);
  if (!content) return;

  const hooksData = safeParseJson(content);
  if (!hooksData || !hooksData.hooks) return;

  // 危险模式
  const dangerousPatterns = [
    { pattern: /\$\(/, desc: "$(...) 命令替换" },
    { pattern: /`[^`]+`/, desc: "反引号命令替换" },
  ];

  for (const [lifecycle, hookEntries] of Object.entries(hooksData.hooks)) {
    if (!Array.isArray(hookEntries)) continue;

    for (const entry of hookEntries) {
      const hooks = entry.hooks || [];
      for (const hook of hooks) {
        if (!hook.command) continue;

        for (const { pattern, desc } of dangerousPatterns) {
          if (pattern.test(hook.command)) {
            addFinding(
              SEVERITY.CRITICAL,
              "Hook 命令注入",
              hooksPath,
              `${lifecycle}: ${desc} in "${hook.command.substring(0, 60)}..."`,
            );
          }
        }
      }
    }
  }
}

/**
 * 2. 权限过宽检查
 */
function checkPermissions() {
  const settingsPath = path.join(PLUGIN_ROOT, "settings.json");
  const content = safeReadFile(settingsPath);
  if (!content) return;

  const settings = safeParseJson(content);
  if (!settings) return;

  // 检查 allow 中的 Bash(*)
  const allow = settings.allow || [];
  for (const rule of allow) {
    if (typeof rule === "string" && /^Bash\(\*\)$/i.test(rule)) {
      addFinding(
        SEVERITY.HIGH,
        "权限过宽",
        settingsPath,
        "Bash(*) 无限制通配符，建议使用精确匹配",
      );
    }
  }
}

/**
 * 3. Deny 清单完整性检查
 */
function checkDenyList() {
  const settingsPath = path.join(PLUGIN_ROOT, "settings.json");
  const content = safeReadFile(settingsPath);
  if (!content) return;

  const settings = safeParseJson(content);
  if (!settings) return;

  const deny = settings.deny || [];
  const denyStr = JSON.stringify(deny).toLowerCase();

  const standardDenyRules = [
    { keyword: "force", desc: "git push --force" },
    { keyword: "reset --hard", desc: "git reset --hard" },
    { keyword: "rm -rf", desc: "rm -rf" },
  ];

  let missingCount = 0;
  const missingRules = [];

  for (const { keyword, desc } of standardDenyRules) {
    if (!denyStr.includes(keyword)) {
      missingCount++;
      missingRules.push(desc);
    }
  }

  if (missingCount >= 3) {
    addFinding(
      SEVERITY.HIGH,
      "Deny 清单",
      settingsPath,
      `缺少 ${missingCount} 项标准拒绝规则: ${missingRules.join(", ")}`,
    );
  } else if (missingCount > 0) {
    addFinding(
      SEVERITY.MEDIUM,
      "Deny 清单",
      settingsPath,
      `缺少 ${missingCount} 项标准拒绝规则: ${missingRules.join(", ")}`,
    );
  }
}

/**
 * 4. Agent 过度授权检查
 */
function checkAgentPermissions() {
  const agentsDir = path.join(PLUGIN_ROOT, "agents");
  const agentFiles = getFiles(agentsDir, /\.md$/);

  for (const file of agentFiles) {
    const content = safeReadFile(file);
    if (!content) continue;

    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const frontmatter = frontmatterMatch[1];
    const hasBash = /allowed-tools:.*Bash/i.test(frontmatter);
    const maxTurnsMatch = frontmatter.match(/maxTurns:\s*(\d+)/);
    const maxTurns = maxTurnsMatch ? parseInt(maxTurnsMatch[1]) : 0;
    const hasSkill = /skills:/i.test(frontmatter);

    if (hasBash && maxTurns > 20 && !hasSkill) {
      addFinding(
        SEVERITY.MEDIUM,
        "Agent 过度授权",
        file,
        `Bash 权限 + maxTurns=${maxTurns} + 无 skill 约束`,
      );
    }
  }
}

/**
 * 5. MCP 信任检查
 */
function checkMcpTrust() {
  const mcpDir = path.join(PLUGIN_ROOT, "mcp-configs");
  if (!fs.existsSync(mcpDir)) return;

  const mcpFiles = getFiles(mcpDir, /\.(json|ya?ml)$/);

  for (const file of mcpFiles) {
    const content = safeReadFile(file);
    if (!content) continue;

    // 检查硬编码凭证
    const secretPatterns = [
      /["']?(?:api[_-]?key|apikey)["']?\s*[:=]\s*["'][^"']{10,}/i,
      /["']?(?:secret|token|password)["']?\s*[:=]\s*["'][^"']{8,}/i,
      /sk-[a-zA-Z0-9]{20,}/,
      /pk_[a-zA-Z0-9]{20,}/,
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        addFinding(
          SEVERITY.CRITICAL,
          "MCP 密钥泄露",
          file,
          "MCP 配置中检测到疑似硬编码凭证",
        );
        break;
      }
    }
  }
}

/**
 * 6. 配置中的密钥检查
 */
function checkConfigSecrets() {
  const filesToCheck = [
    path.join(PLUGIN_ROOT, "settings.json"),
    path.join(PLUGIN_ROOT, "CLAUDE.md"),
    path.join(PLUGIN_ROOT, "hooks", "hooks.json"),
  ];

  const secretPatterns = [
    { pattern: /sk-[a-zA-Z0-9]{20,}/, desc: "OpenAI API Key" },
    { pattern: /pk_(?:live|test)_[a-zA-Z0-9]{20,}/, desc: "Stripe Key" },
    { pattern: /ghp_[a-zA-Z0-9]{36,}/, desc: "GitHub Token" },
    { pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/, desc: "Bearer Token" },
    {
      pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i,
      desc: "硬编码密码",
    },
  ];

  for (const file of filesToCheck) {
    const content = safeReadFile(file);
    if (!content) continue;

    for (const { pattern, desc } of secretPatterns) {
      if (pattern.test(content)) {
        addFinding(SEVERITY.CRITICAL, "配置密钥", file, `检测到 ${desc}`);
      }
    }
  }
}

/**
 * 7. 提示词注入检查
 */
function checkPromptInjection() {
  // 安全审计相关文件记录了注入模式作为检查项，排除误报
  const ALLOWLIST = ["security-audit.md", "config-audit.md"];

  const filesToCheck = [
    path.join(PLUGIN_ROOT, "CLAUDE.md"),
    ...getFiles(path.join(PLUGIN_ROOT, "commands"), /\.md$/),
    ...getFiles(path.join(PLUGIN_ROOT, "skills"), /\.md$/),
  ].filter((f) => !ALLOWLIST.some((a) => f.endsWith(a)));

  const injectionPatterns = [
    {
      pattern: /ignore\s+(?:previous|above|all)/i,
      desc: "ignore previous/above",
    },
    {
      pattern: /disregard\s+(?:previous|above|all)/i,
      desc: "disregard instructions",
    },
    {
      pattern: /forget\s+(?:previous|above|all)/i,
      desc: "forget instructions",
    },
    { pattern: /new\s+instructions?\s*:/i, desc: "new instructions" },
    { pattern: /you\s+are\s+now\s+a/i, desc: "identity override" },
  ];

  for (const file of filesToCheck) {
    const content = safeReadFile(file);
    if (!content) continue;

    // 移除 markdown 代码块、inline code、HTML 注释（避免文档示例误报）
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    for (const { pattern, desc } of injectionPatterns) {
      if (pattern.test(cleanContent)) {
        addFinding(
          SEVERITY.HIGH,
          "提示词注入",
          file,
          `检测到 "${desc}" 模式（需人工确认是否合法用途）`,
        );
      }
    }
  }
}

/**
 * 8. Hook 超时 DoS 检查
 */
function checkHookTimeout() {
  const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
  const content = safeReadFile(hooksPath);
  if (!content) return;

  const hooksData = safeParseJson(content);
  if (!hooksData || !hooksData.hooks) return;

  for (const [lifecycle, hookEntries] of Object.entries(hooksData.hooks)) {
    if (!Array.isArray(hookEntries)) continue;

    for (const entry of hookEntries) {
      const hooks = entry.hooks || [];
      for (const hook of hooks) {
        if (!hook.command) continue;

        if (hook.timeout && hook.timeout > 60) {
          addFinding(
            SEVERITY.LOW,
            "Hook 超时",
            hooksPath,
            `${lifecycle}: timeout=${hook.timeout}s 超过 60 秒`,
          );
        } else if (!hook.timeout) {
          addFinding(
            SEVERITY.INFO,
            "Hook 超时",
            hooksPath,
            `${lifecycle}: "${(hook.command || "").substring(0, 40)}..." 未设置 timeout`,
          );
        }
      }
    }
  }
}

// ==================== 评级计算 ====================

/**
 * 计算整体评级
 */
function calculateGrade() {
  const counts = {};
  for (const level of Object.values(SEVERITY)) {
    counts[level] = findings.filter((f) => f.severity === level).length;
  }

  if (counts.CRITICAL > 1) return { grade: "F", label: "Fail" };
  if (counts.CRITICAL === 1) return { grade: "D", label: "Poor" };
  if (counts.HIGH > 2) return { grade: "C", label: "Needs Work" };
  if (counts.HIGH === 0 && counts.MEDIUM <= 2)
    return { grade: "A", label: "Excellent" };
  if (counts.HIGH <= 2) return { grade: "B", label: "Acceptable" };

  return { grade: "B", label: "Acceptable" };
}

// ==================== 主函数 ====================

function main() {
  console.log("══════════════════════════════════");
  console.log("     CONFIG SECURITY AUDIT");
  console.log("══════════════════════════════════\n");

  // 执行所有扫描
  checkHookInjection();
  checkPermissions();
  checkDenyList();
  checkAgentPermissions();
  checkMcpTrust();
  checkConfigSecrets();
  checkPromptInjection();
  checkHookTimeout();

  // 统计各等级数量
  const counts = {};
  for (const level of Object.values(SEVERITY)) {
    counts[level] = findings.filter((f) => f.severity === level).length;
  }

  // 计算评级
  const { grade, label } = calculateGrade();
  console.log(`📊 Overall Grade: ${grade} (${label})\n`);

  // 按严重性输出
  for (const level of [
    SEVERITY.CRITICAL,
    SEVERITY.HIGH,
    SEVERITY.MEDIUM,
    SEVERITY.LOW,
    SEVERITY.INFO,
  ]) {
    const icon = SEVERITY_ICONS[level];
    const count = counts[level];
    console.log(`${icon} ${level} (${count})`);

    const levelFindings = findings.filter((f) => f.severity === level);
    for (const f of levelFindings) {
      console.log(`   → ${f.file}: ${f.message}`);
    }

    if (count === 0) {
      // 不额外输出
    }
  }

  // 统计
  const totalFiles = new Set(findings.map((f) => f.file)).size;
  const totalIssues = findings.filter(
    (f) => f.severity !== SEVERITY.INFO,
  ).length;

  console.log(`\n══════════════════════════════════`);
  console.log(`  扫描完成: ${totalFiles} 个文件涉及`);
  console.log(`  发现问题: ${totalIssues} 个`);
  console.log(`══════════════════════════════════`);

  // 退出码: CRITICAL 存在则失败
  if (counts.CRITICAL > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main();

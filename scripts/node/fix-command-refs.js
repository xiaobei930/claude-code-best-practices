#!/usr/bin/env node
/**
 * 修复命令引用脚本
 * 将短格式命令（如 /pm, /lead）更新为插件格式（如 /cc-best:pm, /cc-best:lead）
 *
 * 使用方法：
 *   node scripts/node/fix-command-refs.js [--dry-run]
 *
 * 参数：
 *   --dry-run  只显示将要修改的内容，不实际修改文件
 */

const fs = require("fs");
const path = require("path");

// cc-best 插件的命令列表（不包括外部插件命令）
const CC_BEST_COMMANDS = [
  // 角色命令
  "pm",
  "lead",
  "dev",
  "qa",
  "designer",
  "clarify",
  // 模式命令
  "iterate",
  "pair",
  "cc-ralph",
  "mode",
  // 工具命令
  "verify",
  "build",
  "fix",
  "commit",
  "test",
  "run",
  "status",
  "checkpoint",
  "catchup",
  "compact",
  // 其他命令
  "setup",
  "setup-pm",
  "analyze",
  "evolve",
  "learn",
  "docs",
  "context",
  "cleanup",
  "infer",
  "git",
  "memory",
  "pr",
  "self-check",
  "train",
  "task",
];

// 不应该替换的命令（官方或其他插件）
const EXCLUDED_COMMANDS = [
  "clear", // 官方命令
  "frontend-design", // 官方插件
  "code-review", // 官方插件
  "plugin", // 官方命令
  "help", // 官方命令
  "mcp", // 官方命令
];

// 需要扫描的目录
const SCAN_DIRS = [
  "commands",
  "skills",
  "agents",
  ".claude-plugin",
  "rules",
  "templates",
  ".claude/ralph-prompts",
  "docs",
];

// 单独的文件
const SCAN_FILES = [
  "README.md",
  "README.zh-CN.md",
  "FAQ.md",
  "MODES.md",
  "CLAUDE.md",
];

// 不应该修改的上下文模式（如命令标题）
const EXCLUDE_PATTERNS = [
  // 命令标题：# /pm - 产品经理
  /^#\s+\/\w+\s+-/m,
  // 已经是 cc-best 格式的
  /\/cc-best:\w+/,
];

// 构建替换正则表达式
// 匹配 /command 但不匹配 /cc-best:command 或其他已排除的命令
function buildCommandPattern() {
  const cmdList = CC_BEST_COMMANDS.join("|");
  // 匹配 /command 后面跟着空格、换行、逗号、括号、引号或行尾
  // 但不匹配已经是 cc-best: 格式的
  // 也不匹配文件路径中的（如 ./docs, ../docs）
  return new RegExp(
    `(?<!\\.)(?<!\\/cc-best:)(?<!\\/[a-z0-9-]+:)\\/(?:${cmdList})(?=\\s|$|[,)'"\\]\`]|->|→)`,
    "g",
  );
}

function shouldSkipLine(line) {
  // 跳过命令文件的标题行
  if (/^#\s+\/[a-z-]+\s+-/.test(line)) {
    return true;
  }
  // 跳过已经是 cc-best 格式的
  if (/\/cc-best:/.test(line)) {
    return true;
  }
  return false;
}

function processFile(filePath, dryRun) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const pattern = buildCommandPattern();

  let modified = false;
  const newLines = lines.map((line, index) => {
    if (shouldSkipLine(line)) {
      return line;
    }

    const newLine = line.replace(pattern, (match) => {
      const cmd = match.slice(1); // 去掉前导 /
      modified = true;
      return `/cc-best:${cmd}`;
    });

    return newLine;
  });

  if (modified) {
    const newContent = newLines.join("\n");
    if (dryRun) {
      console.log(`\n[DRY-RUN] Would modify: ${filePath}`);
      // 显示差异
      const oldLines = content.split("\n");
      newLines.forEach((newLine, i) => {
        if (oldLines[i] !== newLine) {
          console.log(`  Line ${i + 1}:`);
          console.log(`    - ${oldLines[i]}`);
          console.log(`    + ${newLine}`);
        }
      });
    } else {
      fs.writeFileSync(filePath, newContent, "utf-8");
      console.log(`✅ Modified: ${filePath}`);
    }
    return true;
  }
  return false;
}

function getAllFiles(dir, baseDir) {
  const fullDir = path.join(baseDir, dir);
  if (!fs.existsSync(fullDir)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFilesRecursive(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function getAllFilesRecursive(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFilesRecursive(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // 获取脚本所在目录，然后向上找到项目根目录
  const scriptDir = __dirname;
  const baseDir = path.resolve(scriptDir, "../..");

  console.log(`🔍 Scanning for command references in: ${baseDir}`);
  if (dryRun) {
    console.log("   (DRY-RUN mode - no files will be modified)");
  }

  let totalModified = 0;

  // 扫描目录
  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir, baseDir);
    for (const file of files) {
      if (processFile(file, dryRun)) {
        totalModified++;
      }
    }
  }

  // 扫描单独文件
  for (const file of SCAN_FILES) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
      if (processFile(filePath, dryRun)) {
        totalModified++;
      }
    }
  }

  console.log(
    `\n📊 Summary: ${totalModified} files ${dryRun ? "would be" : ""} modified`,
  );

  if (dryRun && totalModified > 0) {
    console.log("\n💡 Run without --dry-run to apply changes");
  }
}

main();

#!/usr/bin/env node
/**
 * CI 验证脚本: Commands 格式检查
 *
 * 验证所有 command 文件的 frontmatter 完整性。
 * 跨平台支持（Windows/macOS/Linux）
 */

const fs = require("fs");
const path = require("path");

const COMMANDS_DIR = path.join(__dirname, "../../commands");

// 必需字段
const REQUIRED_FIELDS = ["allowed-tools"];

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const data = {};

  yaml.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // 处理数组格式 (简单解析)
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""));
    } else if (value.startsWith('"') || value.startsWith("'")) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  });

  return data;
}

/**
 * 递归查找所有 .md 文件
 */
function findCommandFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findCommandFiles(fullPath, files);
    } else if (item.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 验证单个 command 文件
 */
function validateCommand(filePath) {
  const errors = [];
  const warnings = [];

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    errors.push(`无法读取文件: ${err.message}`);
    return { errors, warnings };
  }

  // 检查文件不为空
  if (content.trim().length === 0) {
    errors.push("文件内容为空");
    return { errors, warnings };
  }

  // 检查 frontmatter 存在
  if (!content.startsWith("---")) {
    errors.push("缺少 YAML frontmatter");
    return { errors, warnings };
  }

  const data = parseFrontmatter(content);
  if (!data) {
    errors.push("YAML frontmatter 格式错误");
    return { errors, warnings };
  }

  // 检查必需字段
  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      errors.push(`缺少必需字段: ${field}`);
    }
  }

  // 验证 allowed-tools 格式
  if (data["allowed-tools"]) {
    const tools = data["allowed-tools"];
    if (typeof tools === "string" && tools.includes(",")) {
      // 字符串格式，检查是否有空格问题
      const parts = tools.split(",").map((s) => s.trim());
      if (parts.some((p) => p.includes(" "))) {
        warnings.push("allowed-tools 中存在可能的格式问题");
      }
    }
  }

  // 检查文件内容不为空
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!bodyMatch || bodyMatch[1].trim().length < 50) {
    warnings.push("文件内容过少，建议添加更多说明");
  }

  return { errors, warnings };
}

/**
 * 主函数
 */
function main() {
  console.log("🔍 验证 Commands...\n");

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.error(`❌ 目录不存在: ${COMMANDS_DIR}`);
    process.exit(1);
  }

  const files = findCommandFiles(COMMANDS_DIR);

  if (files.length === 0) {
    console.log("⚠️  未找到 command 文件");
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;

  for (const filePath of files) {
    const relativePath = path.relative(COMMANDS_DIR, filePath);
    const { errors, warnings } = validateCommand(filePath);

    if (errors.length > 0 || warnings.length > 0) {
      console.log(`📄 ${relativePath}:`);

      for (const error of errors) {
        console.log(`   ❌ ${error}`);
        hasErrors = true;
      }

      for (const warning of warnings) {
        console.log(`   ⚠️  ${warning}`);
        totalWarnings++;
      }

      console.log("");
    }
  }

  // 输出汇总
  console.log("─".repeat(50));
  if (hasErrors) {
    console.log(`❌ 验证失败: ${files.length} 个文件中存在错误`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(
      `⚠️  验证通过: ${files.length} 个文件，${totalWarnings} 个警告`,
    );
  } else {
    console.log(`✅ 验证通过: ${files.length} 个 commands`);
  }
}

main();

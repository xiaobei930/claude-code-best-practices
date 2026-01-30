#!/usr/bin/env node
/**
 * CI 验证脚本: Agents 格式检查
 *
 * 验证所有 agent 文件的 frontmatter 完整性。
 * 跨平台支持（Windows/macOS/Linux）
 */

const fs = require("fs");
const path = require("path");

const AGENTS_DIR = path.join(__dirname, "../../agents");

// 必需字段
const REQUIRED_FIELDS = ["name", "description", "tools"];

// 可选字段
const OPTIONAL_FIELDS = ["model", "skills"];

// 有效的 model 值
const VALID_MODELS = ["opus", "sonnet", "haiku"];

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
 * 验证单个 agent 文件
 */
function validateAgent(filePath) {
  const errors = [];
  const warnings = [];
  const fileName = path.basename(filePath);

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    errors.push(`无法读取文件: ${err.message}`);
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

  // 验证 name 与文件名一致
  if (data.name) {
    const expectedName = fileName.replace(".md", "");
    if (data.name !== expectedName) {
      warnings.push(`name "${data.name}" 与文件名 "${expectedName}" 不一致`);
    }
  }

  // 验证 model 值
  if (data.model && !VALID_MODELS.includes(data.model)) {
    errors.push(
      `无效的 model 值: ${data.model}，应为 ${VALID_MODELS.join("/")}`,
    );
  }

  // 验证 description 长度
  if (data.description && data.description.length < 20) {
    warnings.push("description 过短，建议至少 20 字符");
  }

  // 检查文件内容不为空
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!bodyMatch || bodyMatch[1].trim().length < 100) {
    warnings.push("文件内容过少，建议添加更多说明");
  }

  return { errors, warnings };
}

/**
 * 主函数
 */
function main() {
  console.log("🔍 验证 Agents...\n");

  if (!fs.existsSync(AGENTS_DIR)) {
    console.error(`❌ 目录不存在: ${AGENTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.log("⚠️  未找到 agent 文件");
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;

  for (const file of files) {
    const filePath = path.join(AGENTS_DIR, file);
    const { errors, warnings } = validateAgent(filePath);

    if (errors.length > 0 || warnings.length > 0) {
      console.log(`📄 ${file}:`);

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
    console.log(`✅ 验证通过: ${files.length} 个 agents`);
  }
}

main();

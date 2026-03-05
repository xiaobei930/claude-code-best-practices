#!/usr/bin/env node
/**
 * CI 验证脚本: Skills 格式检查
 *
 * 验证所有 skill 目录的结构和 SKILL.md 文件完整性。
 * 跨平台支持（Windows/macOS/Linux）
 */

const fs = require("fs");
const path = require("path");

const { parseFrontmatter } = require("./lib/parse-frontmatter");

const SKILLS_DIR = path.join(__dirname, "../../skills");

// SKILL.md 必需字段
const REQUIRED_FIELDS = ["name", "description"];

// 可选字段
const OPTIONAL_FIELDS = ["allowed-tools", "auto-activate"];

/**
 * 递归查找所有 SKILL.md 文件
 */
function findSkillFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findSkillFiles(fullPath, files);
    } else if (item === "SKILL.md") {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 验证单个 skill 文件
 */
function validateSkill(filePath) {
  const errors = [];
  const warnings = [];
  const relativePath = path.relative(SKILLS_DIR, filePath);

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

  // 验证 description 长度
  if (data.description && data.description.length < 20) {
    warnings.push("description 过短，建议至少 20 字符");
  }

  // 检查文件内容不为空
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!bodyMatch || bodyMatch[1].trim().length < 50) {
    warnings.push("文件内容过少，建议添加更多说明");
  }

  // 检查目录名与 name 是否一致
  const dirName = path.basename(path.dirname(filePath));
  if (data.name && data.name !== dirName) {
    warnings.push(`name "${data.name}" 与目录名 "${dirName}" 不一致`);
  }

  return { errors, warnings };
}

/**
 * 主函数
 */
function main() {
  console.log("🔍 验证 Skills...\n");

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`❌ 目录不存在: ${SKILLS_DIR}`);
    process.exit(1);
  }

  const files = findSkillFiles(SKILLS_DIR);

  if (files.length === 0) {
    console.log("⚠️  未找到 SKILL.md 文件");
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;

  for (const filePath of files) {
    const relativePath = path.relative(SKILLS_DIR, filePath);
    const { errors, warnings } = validateSkill(filePath);

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

  // 计数完整性检查（防止文件意外丢失）
  const MIN_EXPECTED_SKILLS = 15;
  if (files.length < MIN_EXPECTED_SKILLS) {
    console.log(
      `❌ Skills 数量异常: 仅 ${files.length} 个（预期至少 ${MIN_EXPECTED_SKILLS}）`,
    );
    hasErrors = true;
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
    console.log(`✅ 验证通过: ${files.length} 个 skills`);
  }
}

main();

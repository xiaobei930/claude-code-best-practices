#!/usr/bin/env node
/**
 * CI 验证脚本: Agents 格式检查
 *
 * 验证所有 agent 文件的 frontmatter 完整性。
 * 跨平台支持（Windows/macOS/Linux）
 */

const fs = require("fs");
const path = require("path");

const { parseFrontmatter } = require("./lib/parse-frontmatter");

const AGENTS_DIR = path.join(__dirname, "../../agents");

// 必需字段
const REQUIRED_FIELDS = ["name", "description", "tools"];

// 可选字段
const OPTIONAL_FIELDS = ["model", "skills"];

// 有效的 model 值
const VALID_MODELS = ["opus", "sonnet", "haiku"];

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

  // 验证 description 长度和触发条件
  if (data.description && data.description.length < 20) {
    warnings.push("description 过短，建议至少 20 字符");
  } else if (data.description && data.description.length < 50) {
    warnings.push(
      `description 较短 (${data.description.length} chars)，建议添加触发条件（如 "Use PROACTIVELY when..."）`,
    );
  }

  // 检查文件内容不为空
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!bodyMatch || bodyMatch[1].trim().length < 100) {
    warnings.push("文件内容过少，建议添加更多说明");
  }

  return { errors, warnings };
}

/**
 * 验证 plugin.json 中的 agents 字段格式
 * 防止 v0.6.2 的格式 bug 再次发生（目录路径 vs 文件路径）
 */
function validatePluginAgents(agentFiles) {
  const errors = [];
  const warnings = [];
  const pluginPath = path.join(__dirname, "../../.claude-plugin/plugin.json");

  if (!fs.existsSync(pluginPath)) {
    // 非插件模式（Clone 用户），跳过
    return { errors, warnings };
  }

  let plugin;
  try {
    plugin = JSON.parse(fs.readFileSync(pluginPath, "utf-8"));
  } catch (err) {
    errors.push(`plugin.json 解析失败: ${err.message}`);
    return { errors, warnings };
  }

  const agents = plugin.agents;

  // agents 必须是数组
  if (!Array.isArray(agents)) {
    errors.push("plugin.json agents 字段必须是数组");
    return { errors, warnings };
  }

  // 每个元素必须以 .md 结尾（不能是目录路径）
  for (const entry of agents) {
    if (typeof entry !== "string") {
      errors.push(`agents 元素必须是字符串，实际: ${typeof entry}`);
      continue;
    }
    if (entry.endsWith("/")) {
      errors.push(`agents 不支持目录路径: "${entry}"，必须列出每个 .md 文件`);
    }
    if (!entry.endsWith(".md")) {
      errors.push(`agents 路径必须以 .md 结尾: "${entry}"`);
    }
  }

  // agents 数量与实际 agents/ 目录中的 .md 文件数量一致
  const pluginCount = agents.length;
  const actualCount = agentFiles.length;
  if (pluginCount !== actualCount) {
    errors.push(
      `plugin.json 声明 ${pluginCount} 个 agents，实际目录有 ${actualCount} 个`,
    );
  }

  // 每个路径对应的文件必须存在
  const pluginRoot = path.join(__dirname, "../../");
  for (const entry of agents) {
    if (typeof entry !== "string") continue;
    const resolved = path.join(pluginRoot, entry);
    if (!fs.existsSync(resolved)) {
      errors.push(`plugin.json 引用的文件不存在: "${entry}"`);
    }
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

  const MIN_EXPECTED_AGENTS = 6;
  if (files.length < MIN_EXPECTED_AGENTS) {
    console.error(
      `❌ Agents 数量异常: 仅 ${files.length} 个（预期至少 ${MIN_EXPECTED_AGENTS}）`,
    );
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("⚠️  未找到 agent 文件");
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;

  // 验证每个 agent 文件的 frontmatter
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

  // 验证 plugin.json agents 字段格式
  console.log("🔍 验证 plugin.json agents 字段...\n");
  const { errors: pluginErrors, warnings: pluginWarnings } =
    validatePluginAgents(files);

  for (const error of pluginErrors) {
    console.log(`   ❌ ${error}`);
    hasErrors = true;
  }
  for (const warning of pluginWarnings) {
    console.log(`   ⚠️  ${warning}`);
    totalWarnings++;
  }

  // 输出汇总
  console.log("\n" + "─".repeat(50));
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

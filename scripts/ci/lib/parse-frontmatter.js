/**
 * 共享 YAML frontmatter 解析器
 *
 * 支持: 单行值、内联数组 [a, b]、多行数组 (- item)、多行字符串 (|/>)、带引号值
 * 被 validate-agents.js、validate-commands.js、validate-skills.js 共用
 */

/**
 * 解析 YAML frontmatter
 * @param {string} content - 文件完整内容
 * @returns {Object|null} 解析后的键值对，或 null（无 frontmatter）
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const lines = match[1].split("\n");
  const data = {};
  let currentKey = null;
  let multilineMode = null; // 'array' | 'string' | null

  for (const line of lines) {
    // 多行数组项: "  - value"
    if (multilineMode === "array" && /^\s+-\s+/.test(line)) {
      const item = line.replace(/^\s+-\s+/, "").trim();
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(item);
      continue;
    }

    // 多行字符串续行: 以空格开头的非数组行
    if (
      multilineMode === "string" &&
      /^\s+/.test(line) &&
      !/^\s+-\s+/.test(line)
    ) {
      data[currentKey] += " " + line.trim();
      continue;
    }

    // 遇到新的顶层 key，结束多行模式
    multilineMode = null;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    if (!key || /^\s/.test(line.charAt(0))) continue;
    let value = line.slice(colonIndex + 1).trim();

    currentKey = key;

    // 内联数组: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""));
    }
    // 多行字符串指示符: | 或 >
    else if (value === "|" || value === ">") {
      data[key] = "";
      multilineMode = "string";
    }
    // 空值 → 后续可能是多行数组
    else if (value === "") {
      data[key] = [];
      multilineMode = "array";
    }
    // 带引号的字符串
    else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
    }
    // 普通值
    else {
      data[key] = value;
    }
  }

  return data;
}

module.exports = { parseFrontmatter };

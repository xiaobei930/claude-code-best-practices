#!/usr/bin/env node
/**
 * progress.md 归档脚本
 *
 * 功能：将 progress.md 中超出限制的历史记录移动到 progress-archive.md
 *
 * 使用：node archive-progress.js [memory-bank-path]
 *
 * 滚动窗口策略：
 * - 最近完成: 保留 5 项
 * - 最近决策: 保留 5 条
 * - 最近检查点: 保留 5 个
 */

const fs = require("fs");
const path = require("path");

// 配置
const CONFIG = {
  maxCompleted: 5, // 最近完成保留数量
  maxDecisions: 5, // 最近决策保留数量
  maxCheckpoints: 5, // 最近检查点保留数量
  maxLines: 300, // progress.md 最大行数警告阈值
};

// 获取 memory-bank 路径
const memoryBankPath =
  process.argv[2] || path.join(process.cwd(), "memory-bank");
const progressPath = path.join(memoryBankPath, "progress.md");
const archivePath = path.join(memoryBankPath, "progress-archive.md");

// 工具函数
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    return null;
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf-8");
}

function getTimestamp() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function getYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 解析 Markdown 列表项
function parseListItems(content, sectionName) {
  const regex = new RegExp(
    `## ${sectionName}\\s*\\n<!-- [^>]+ -->\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---\\s*$|$)`,
    "m",
  );
  const match = content.match(regex);
  if (!match) return [];

  const items = match[1]
    .trim()
    .split("\n")
    .filter((line) => line.match(/^- \[[ x]\]/));
  return items;
}

// 解析 Markdown 表格行
function parseTableRows(content, sectionName) {
  const regex = new RegExp(
    `## ${sectionName}\\s*\\n<!-- [^>]+ -->\\s*\\n\\|[^\\n]+\\|\\s*\\n\\|[-|\\s]+\\|\\s*\\n([\\s\\S]*?)(?=\\n## |\\n###|\\n---\\s*$|$)`,
    "m",
  );
  const match = content.match(regex);
  if (!match) return [];

  const rows = match[1]
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.match(/^\|[\s-|]+\|$/));
  return rows;
}

// 更新 progress.md 中的列表
function updateListSection(content, sectionName, items) {
  const regex = new RegExp(
    `(## ${sectionName}\\s*\\n<!-- [^>]+ -->\\s*\\n)[\\s\\S]*?(?=\\n## |\\n---\\s*$|$)`,
    "m",
  );
  const newContent = items.length > 0 ? items.join("\n") + "\n" : "\n";
  return content.replace(regex, `$1${newContent}`);
}

// 更新 progress.md 中的表格
function updateTableSection(
  content,
  sectionName,
  rows,
  headerIncluded = false,
) {
  const regex = new RegExp(
    `(## ${sectionName}\\s*\\n<!-- [^>]+ -->\\s*\\n\\|[^\\n]+\\|\\s*\\n\\|[-|\\s]+\\|\\s*\\n)[\\s\\S]*?(?=\\n## |\\n###|\\n---\\s*$|$)`,
    "m",
  );
  const newContent = rows.length > 0 ? rows.join("\n") + "\n" : "\n";
  return content.replace(regex, `$1${newContent}`);
}

// 添加到归档文件
function appendToArchive(archiveContent, section, items, isTable = false) {
  if (items.length === 0) return archiveContent;

  const sectionRegex = new RegExp(
    `(## ${section}\\s*\\n[\\s\\S]*?)(?=\\n---\\s*$|\\n## |$)`,
    "m",
  );
  const match = archiveContent.match(sectionRegex);

  if (!match) return archiveContent;

  const existingSection = match[1];
  let newItems;

  if (isTable) {
    // 表格：在表头后插入
    const tableHeaderRegex = /(\|[-|\s]+\|\s*\n)/;
    newItems = existingSection.replace(
      tableHeaderRegex,
      `$1${items.join("\n")}\n`,
    );
  } else {
    // 列表：在月份标题后插入
    const yearMonth = getYearMonth();
    const monthHeader = `### ${yearMonth}`;

    if (existingSection.includes(monthHeader)) {
      // 已有当月标题，在其后插入
      newItems = existingSection.replace(
        new RegExp(`(${monthHeader}\\s*\\n)`),
        `$1${items.join("\n")}\n`,
      );
    } else {
      // 没有当月标题，添加新标题
      newItems = existingSection.replace(
        /(<!-- [^>]+ -->\s*\n)/,
        `$1\n${monthHeader}\n\n${items.join("\n")}\n`,
      );
    }
  }

  return archiveContent.replace(sectionRegex, newItems);
}

// 添加归档日志
function addArchiveLog(archiveContent, archivedItems, sourceLines) {
  const timestamp = getTimestamp();
  const summary = Object.entries(archivedItems)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => `${name}:${count}`)
    .join(", ");

  if (!summary) return archiveContent;

  const logEntry = `| ${timestamp} | ${summary} | ${sourceLines} |`;

  return archiveContent.replace(
    /(## 归档日志\s*\n<!-- [^>]+ -->\s*\n\|[^\n]+\|\s*\n\|[-|\s]+\|\s*\n)/,
    `$1${logEntry}\n`,
  );
}

// 主函数
function main() {
  console.log("📦 progress.md 归档工具");
  console.log("========================\n");

  // 读取文件
  let progressContent = readFile(progressPath);
  let archiveContent = readFile(archivePath);

  if (!progressContent) {
    console.log("❌ 找不到 progress.md");
    process.exit(1);
  }

  if (!archiveContent) {
    console.log("⚠️  找不到 progress-archive.md，将创建新文件");
    archiveContent = `# 项目进度归档

> 本文件存储 progress.md 的历史记录

## 已完成任务

<!-- 所有已完成的任务 -->

---

## 决策记录归档

<!-- 历史决策记录 -->

| 日期 | 角色 | 决策 | 依据 | 置信度 |
|------|------|------|------|--------|

---

## 检查点历史

<!-- 所有历史检查点 -->

| 时间 | 完成内容 | Git Commit |
|------|----------|------------|

---

## 归档日志

<!-- 每次归档操作的记录 -->

| 时间 | 归档内容 | 来源行数 |
|------|----------|----------|
`;
  }

  const originalLines = progressContent.split("\n").length;
  console.log(`📄 当前 progress.md: ${originalLines} 行`);

  const archivedItems = {
    完成: 0,
    决策: 0,
    检查点: 0,
  };

  // 处理"最近完成"
  const completedItems = parseListItems(progressContent, "最近完成");
  if (completedItems.length > CONFIG.maxCompleted) {
    const toArchive = completedItems.slice(CONFIG.maxCompleted);
    const toKeep = completedItems.slice(0, CONFIG.maxCompleted);

    // 为归档项添加日期标记
    const datedItems = toArchive.map((item) => {
      if (!item.includes(" - ")) {
        return item + ` - ${getTimestamp().split(" ")[0]}`;
      }
      return item;
    });

    archiveContent = appendToArchive(
      archiveContent,
      "已完成任务",
      datedItems,
      false,
    );
    progressContent = updateListSection(progressContent, "最近完成", toKeep);
    archivedItems["完成"] = toArchive.length;
    console.log(`✅ 归档 ${toArchive.length} 项已完成任务`);
  }

  // 处理"最近决策"
  const decisionRows = parseTableRows(progressContent, "最近决策");
  if (decisionRows.length > CONFIG.maxDecisions) {
    const toArchive = decisionRows.slice(CONFIG.maxDecisions);
    const toKeep = decisionRows.slice(0, CONFIG.maxDecisions);

    archiveContent = appendToArchive(
      archiveContent,
      "决策记录归档",
      toArchive,
      true,
    );
    progressContent = updateTableSection(progressContent, "最近决策", toKeep);
    archivedItems["决策"] = toArchive.length;
    console.log(`✅ 归档 ${toArchive.length} 条决策记录`);
  }

  // 处理"最近检查点"
  const checkpointRows = parseTableRows(progressContent, "最近检查点");
  if (checkpointRows.length > CONFIG.maxCheckpoints) {
    const toArchive = checkpointRows.slice(CONFIG.maxCheckpoints);
    const toKeep = checkpointRows.slice(0, CONFIG.maxCheckpoints);

    archiveContent = appendToArchive(
      archiveContent,
      "检查点历史",
      toArchive,
      true,
    );
    progressContent = updateTableSection(progressContent, "最近检查点", toKeep);
    archivedItems["检查点"] = toArchive.length;
    console.log(`✅ 归档 ${toArchive.length} 个检查点`);
  }

  // 检查是否有归档
  const totalArchived = Object.values(archivedItems).reduce((a, b) => a + b, 0);

  if (totalArchived === 0) {
    console.log("\n✨ 无需归档，progress.md 大小在限制范围内");

    if (originalLines > CONFIG.maxLines) {
      console.log(
        `\n⚠️  警告: 文件有 ${originalLines} 行，超过建议的 ${CONFIG.maxLines} 行`,
      );
      console.log("   考虑手动清理备注或其他非结构化内容");
    }

    process.exit(0);
  }

  // 添加归档日志
  archiveContent = addArchiveLog(archiveContent, archivedItems, originalLines);

  // 写入文件
  writeFile(progressPath, progressContent);
  writeFile(archivePath, archiveContent);

  const newLines = progressContent.split("\n").length;

  console.log("\n📊 归档完成");
  console.log(`   progress.md: ${originalLines} → ${newLines} 行`);
  console.log(`   已归档: ${totalArchived} 条记录`);

  if (newLines > CONFIG.maxLines) {
    console.log(`\n⚠️  文件仍有 ${newLines} 行，考虑手动清理备注内容`);
  }
}

main();

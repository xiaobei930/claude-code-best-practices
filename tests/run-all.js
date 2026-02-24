#!/usr/bin/env node
/**
 * 统一测试运行器
 *
 * 遍历 tests/ 目录下所有 *.test.js 文件并执行。
 * 使用 node:test + node:assert（零依赖，Node 18+ 原生支持）。
 *
 * 用法: node tests/run-all.js
 *
 * Exit codes:
 * - 0: 全部通过
 * - 1: 有失败
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const TESTS_DIR = __dirname;

/**
 * 递归查找所有 *.test.js 文件
 */
function findTestFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

/**
 * 运行单个测试文件
 */
function runTestFile(filePath) {
  const relativePath = path.relative(TESTS_DIR, filePath);
  const startTime = Date.now();

  try {
    execSync(`node --test "${filePath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });
    const duration = Date.now() - startTime;
    return { file: relativePath, passed: true, duration, error: null };
  } catch (err) {
    const duration = Date.now() - startTime;
    // node --test 将测试输出写入 stdout/stderr
    const output = (err.stdout || "") + (err.stderr || "");
    return { file: relativePath, passed: false, duration, error: output };
  }
}

// ==================== 主流程 ====================

const testFiles = findTestFiles(TESTS_DIR);

if (testFiles.length === 0) {
  console.log("⚠️  未找到测试文件 (*.test.js)");
  process.exit(0);
}

console.log(`\n${"═".repeat(50)}`);
console.log(`  CC-Best 测试套件`);
console.log(`${"═".repeat(50)}\n`);
console.log(`找到 ${testFiles.length} 个测试文件\n`);

const results = [];
let passCount = 0;
let failCount = 0;

for (const file of testFiles) {
  const result = runTestFile(file);
  results.push(result);

  if (result.passed) {
    passCount++;
    console.log(`  ✅ ${result.file} (${result.duration}ms)`);
  } else {
    failCount++;
    console.log(`  ❌ ${result.file} (${result.duration}ms)`);
    if (result.error) {
      // 只显示错误摘要（最后 10 行）
      const lines = result.error.trim().split("\n");
      const summary = lines.slice(-10).join("\n");
      console.log(`     ${summary.replace(/\n/g, "\n     ")}`);
    }
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(
  `  结果: ${passCount} 通过, ${failCount} 失败, 共 ${testFiles.length} 个文件`,
);
console.log(`${"═".repeat(50)}\n`);

// 输出 JSON 摘要（可被 CI 解析）
const summary = {
  status: failCount === 0 ? "success" : "failure",
  total: testFiles.length,
  passed: passCount,
  failed: failCount,
  details: results.map((r) => ({
    file: r.file,
    passed: r.passed,
    duration: r.duration,
  })),
};

// 写入结果文件供 CI 使用
const resultsPath = path.join(TESTS_DIR, ".results.json");
fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));

process.exit(failCount > 0 ? 1 : 0);

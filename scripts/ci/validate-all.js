#!/usr/bin/env node
/**
 * CI 验证脚本: 主入口
 *
 * 运行所有验证脚本并汇总结果。
 * 跨平台支持（Windows/macOS/Linux）
 */

const { spawn } = require("child_process");
const path = require("path");

const VALIDATORS = [
  { name: "Agents", script: "validate-agents.js" },
  { name: "Skills", script: "validate-skills.js" },
  { name: "Commands", script: "validate-commands.js" },
  { name: "Hooks", script: "validate-hooks.js" },
];

/**
 * 运行单个验证脚本
 */
function runValidator(script) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, script);
    const child = spawn("node", [scriptPath], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", (err) => {
      console.error(`运行 ${script} 失败: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║              CC-Best 组件验证                          ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const results = [];

  for (const { name, script } of VALIDATORS) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ${name} 验证`);
    console.log(`${"═".repeat(60)}\n`);

    const success = await runValidator(script);
    results.push({ name, success });
  }

  // 汇总结果
  console.log(`\n${"═".repeat(60)}`);
  console.log("  验证结果汇总");
  console.log(`${"═".repeat(60)}\n`);

  let allPassed = true;

  for (const { name, success } of results) {
    const status = success ? "✅ 通过" : "❌ 失败";
    console.log(`  ${name.padEnd(12)} ${status}`);
    if (!success) allPassed = false;
  }

  console.log("");

  if (allPassed) {
    console.log("🎉 所有验证通过！");
    process.exit(0);
  } else {
    console.log("💥 存在验证失败，请检查上述错误");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("验证脚本执行失败:", err);
  process.exit(1);
});

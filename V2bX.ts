#!/usr/bin/env -S deno run --allow-all

import { $ } from "@david/dax";
import { check_status, install_V2bX, release } from "./install.js";
import { generate_config_file } from "./initconfig.js";
import * as process from "node:process";
import { argv, env, exit } from "node:process";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

// check root
if (process.getuid && process.getuid() !== 0) {
  $.logError(`${red}错误: ${plain} 必须使用root用户运行此脚本！\n`);
  exit(1);
}

// OS checks are already done in install.ts and imported via release variable if needed,
// but V2bX.sh does some specific checks too.
// We can rely on install.ts checks or re-implement if strictly necessary.
// install.ts does exit if OS is not supported.

async function confirm(question: string, defaultVal: string): Promise<boolean> {
  const prompt = `${question} [${defaultVal === "y" ? "y/n" : "y/N"}]: `;
  const result = await $.prompt(prompt, { default: defaultVal });
  return result.toLowerCase() === "y";
}

async function confirm_restart() {
  if (await confirm("是否重启V2bX", "y")) {
    await restart();
  } else {
    await show_menu();
  }
}

async function before_show_menu() {
  $.log("");
  await $.prompt(`${yellow}按回车返回主菜单: ${plain}`);
  await show_menu();
}

async function install() {
  // In TS we call the function directly
  await install_V2bX();
  if (argv.length <= 2) {
    await start();
  } else {
    await start(0);
  }
}

async function update(version?: string) {
  let ver = version;
  if (!ver) {
    ver = await $.prompt("输入指定版本(默认最新版): ");
  }
  await install_V2bX(ver);
  $.log(
    `${green}更新完成，已自动重启 V2bX，请使用 V2bX log 查看运行日志${plain}`,
  );
  exit(0);
}

async function config() {
  $.log("V2bX在修改配置后会自动尝试重启");
  // Try to use available editor
  const editor = env.EDITOR || "vi";
  try {
    await $`${editor} /etc/V2bX/config.json`;
  } catch {
    $.logError(
      `${red}无法打开编辑器 ${editor}，请手动编辑 /etc/V2bX/config.json${plain}`,
    );
  }
  await $.sleep(2000);
  await restart();
  const status = await check_status();
  if (status === 0) {
    $.log(`V2bX状态: ${green}已运行${plain}`);
  } else if (status === 1) {
    if (
      await confirm("检测到您未启动V2bX或V2bX自动重启失败，是否查看日志？", "y")
    ) {
      await show_log();
    }
  } else {
    $.logError(`V2bX状态: ${red}未安装${plain}`);
  }
}

async function uninstall() {
  if (!(await confirm("确定要卸载 V2bX 吗?", "n"))) {
    if (argv.length <= 2) {
      await show_menu();
    }
    return;
  }

  if (release === "alpine") {
    await $`service V2bX stop`;
    await $`rc-update del V2bX`;
    await $`rm /etc/init.d/V2bX -f`;
  } else {
    await $`systemctl stop V2bX`;
    await $`systemctl disable V2bX`;
    await $`rm /etc/systemd/system/V2bX.service -f`;
    await $`systemctl daemon-reload`;
    await $`systemctl reset-failed`;
  }
  await $`rm /etc/V2bX/ -rf`;
  await $`rm /usr/local/V2bX/ -rf`;

  $.log("");
  $.log(
    `卸载成功，如果你想删除此脚本，则退出脚本后运行 ${green}rm ${
      argv[1]
    } -f${plain} 进行删除`,
  ); // Adjusted message
  $.log("");

  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function start(arg?: any) {
  const status = await check_status();
  if (status === 0) {
    $.log("");
    $.log(`${green}V2bX已运行，无需再次启动，如需重启请选择重启${plain}`);
  } else {
    if (release === "alpine") {
      await $`service V2bX start`;
    } else {
      await $`systemctl start V2bX`;
    }
    await $.sleep(2000);
    const newStatus = await check_status();
    if (newStatus === 0) {
      $.log(`${green}V2bX 启动成功，请使用 V2bX log 查看运行日志${plain}`);
    } else {
      $.logError(
        `${red}V2bX可能启动失败，请稍后使用 V2bX log 查看日志信息${plain}`,
      );
    }
  }

  if (argv.length <= 2 && arg === undefined) {
    await before_show_menu();
  }
}

async function stop() {
  if (release === "alpine") {
    await $`service V2bX stop`;
  } else {
    await $`systemctl stop V2bX`;
  }
  await $.sleep(2000);
  const status = await check_status();
  if (status === 1) {
    $.log(`${green}V2bX 停止成功${plain}`);
  } else {
    $.logError(
      `${red}V2bX停止失败，可能是因为停止时间超过了两秒，请稍后查看日志信息${plain}`,
    );
  }

  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function restart() {
  if (release === "alpine") {
    await $`service V2bX restart`;
  } else {
    await $`systemctl restart V2bX`;
  }
  await $.sleep(2000);
  const status = await check_status();
  if (status === 0) {
    $.log(`${green}V2bX 重启成功，请使用 V2bX log 查看运行日志${plain}`);
  } else {
    $.logError(
      `${red}V2bX可能启动失败，请稍后使用 V2bX log 查看日志信息${plain}`,
    );
  }
  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function status() {
  if (release === "alpine") {
    await $`service V2bX status`;
  } else {
    await $`systemctl status V2bX --no-pager -l`;
  }
  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function enable() {
  if (release === "alpine") {
    await $`rc-update add V2bX`;
  } else {
    await $`systemctl enable V2bX`;
  }
  $.log(`${green}V2bX 设置开机自启成功${plain}`); // Simplified success check

  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function disable() {
  if (release === "alpine") {
    await $`rc-update del V2bX`;
  } else {
    await $`systemctl disable V2bX`;
  }
  $.log(`${green}V2bX 取消开机自启成功${plain}`);

  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function show_log() {
  if (release === "alpine") {
    $.logError(`${red}alpine系统暂不支持日志查看${plain}\n`);
    exit(1);
  } else {
    await $`journalctl -u V2bX.service -e --no-pager -f`;
  }
  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function install_bbr() {
  await $`bash <(curl -L -s https://github.com/ylx2016/Linux-NetSpeed/raw/master/tcpx.sh)`;
}

async function update_shell() {
  $.log(
    `${green}To update this script, please pull the latest changes from the repository.${plain}`,
  );
  // Since we are using TS files, "updating shell" might mean git pull if it's a git repo, or downloading new TS files.
  // For now, let's just print a message.
  exit(0);
}

async function check_enabled(): Promise<boolean> {
  if (release === "alpine") {
    const temp = await $`rc-update show`.text();
    return temp.includes("V2bX");
  } else {
    try {
      const temp = await $`systemctl is-enabled V2bX`.text();
      return temp.includes("enabled");
    } catch {
      return false;
    }
  }
}

async function show_status() {
  const statusVal = await check_status();
  if (statusVal === 0) {
    $.log(`V2bX状态: ${green}已运行${plain}`);
    await show_enable_status();
  } else if (statusVal === 1) {
    $.logWarn(`V2bX状态: ${yellow}未运行${plain}`);
    await show_enable_status();
  } else {
    $.logError(`V2bX状态: ${red}未安装${plain}`);
  }
}

async function show_enable_status() {
  if (await check_enabled()) {
    $.log(`是否开机自启: ${green}是${plain}`);
  } else {
    $.log(`是否开机自启: ${red}否${plain}`);
  }
}

async function generate_x25519_key() {
  $.log("正在生成 x25519 密钥：");
  await $`/usr/local/V2bX/V2bX x25519`;
  $.log("");
  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function show_V2bX_version() {
  $.log("V2bX 版本：");
  await $`/usr/local/V2bX/V2bX version`;
  $.log("");
  if (argv.length <= 2) {
    await before_show_menu();
  }
}

async function show_menu() {
  $.log("");
  await show_status();
  $.log("  1.  安装 V2bX");
  $.log("  2.  更新 V2bX");
  $.log("  3.  卸载 V2bX");
  $.log("------------------------------------------");
  $.log("  4.  启动 V2bX");
  $.log("  5.  停止 V2bX");
  $.log("  6.  重启 V2bX");
  $.log("  7.  查看 V2bX 状态");
  $.log("  8.  查看 V2bX 日志");
  $.log("------------------------------------------");
  $.log("  9.  设置 V2bX 开机自启");
  $.log(" 10.  取消 V2bX 开机自启");
  $.log("------------------------------------------");
  $.log(" 11.  一键安装 bbr (最新内核)");
  $.log(" 12.  查看 V2bX 版本");
  $.log(" 13.  生成 x25519 密钥");
  $.log(" 14.  生成 V2bX 配置文件");
  $.log(" 15.  修改 V2bX 配置文件");
  $.log(" 16.  升级维护脚本");
  $.log(" 0.   退出脚本");
  $.log("");

  const num = await $.prompt("请输入选择:", { default: "0" });
  switch (num) {
    case "1":
      await install();
      break;
    case "2":
      await update();
      break;
    case "3":
      await uninstall();
      break;
    case "4":
      await start();
      break;
    case "5":
      await stop();
      break;
    case "6":
      await restart();
      break;
    case "7":
      await status();
      break;
    case "8":
      await show_log();
      break;
    case "9":
      await enable();
      break;
    case "10":
      await disable();
      break;
    case "11":
      await install_bbr();
      break;
    case "12":
      await show_V2bX_version();
      break;
    case "13":
      await generate_x25519_key();
      break;
    case "14":
      await generate_config_file();
      break;
    case "15":
      await config();
      break;
    case "16":
      await update_shell();
      break;
    case "0":
      exit(0);
      break;
    default:
      $.logError(`${red}请输入正确的数字 [0-16]${plain}`);
      await $.sleep(1000);
      await show_menu();
      break;
  }
}

if (argv.length > 2) {
  const command = argv[2];
  const param = argv[3];
  switch (command) {
    case "start":
      await start(0);
      break;
    case "stop":
      await stop();
      break;
    case "restart":
      await restart();
      break;
    case "status":
      await status();
      break;
    case "enable":
      await enable();
      break;
    case "disable":
      await disable();
      break;
    case "log":
      await show_log();
      break;
    case "x25519":
      await generate_x25519_key();
      break;
    case "generate":
      await generate_config_file();
      break;
    case "update":
      if (param) await update(param);
      else await update();
      break;
    case "install":
      await install();
      break;
    case "uninstall":
      await uninstall();
      break;
    case "version":
      await show_V2bX_version();
      break;
    default:
      await show_menu();
      break;
  }
} else {
  await show_menu();
}

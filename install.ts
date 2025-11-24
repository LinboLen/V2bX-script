#!/usr/bin/env -S deno run --allow-all

import { $ } from "@david/dax";
import { argv, exit, getuid } from "node:process";
import { fileURLToPath } from "node:url";
import { install_base } from "./internal/install-base.ts";
import { install_V2bX } from "./internal/install-v2bx.ts";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
// const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

// check root
if (getuid && getuid() !== 0) {
  $.logError(`${red}错误：${plain} 必须使用root用户运行此脚本！\n`);
  exit(1);
}

const currentPath = $.path(fileURLToPath(import.meta.url));
if ($.path(argv[1]).realPathSync().equals(currentPath)) {
  $.log(`${green}开始安装${plain}`);
  await install_base();
  await install_V2bX(argv[2]);
}

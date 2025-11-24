import { $ } from "@david/dax";
import * as fs from "node:fs/promises";
import { exit } from "node:process";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
// const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

let release = "";
let arch = "";
let os_version = "";

export async function osInfo() {
  // check os
  if (release.length && arch.length && os_version.length) {
    return {
      release,
      arch,
      os_version,
    };
  }

  const osRelease = await fs.readFile("/etc/os-release", "utf-8").catch(() =>
    ""
  );
  const issue = await fs.readFile("/etc/issue", "utf-8").catch(() => "");
  const procVersion = await fs.readFile("/proc/version", "utf-8").catch(() =>
    ""
  );

  if (await $.path("/etc/redhat-release").exists()) {
    release = "centos";
  } else if (issue.match(/alpine/i)) {
    release = "alpine";
  } else if (issue.match(/debian/i)) {
    release = "debian";
  } else if (issue.match(/ubuntu/i)) {
    release = "ubuntu";
  } else if (issue.match(/centos|red hat|redhat|rocky|alma|oracle linux/i)) {
    release = "centos";
  } else if (procVersion.match(/debian/i)) {
    release = "debian";
  } else if (procVersion.match(/ubuntu/i)) {
    release = "ubuntu";
  } else if (
    procVersion.match(/centos|red hat|redhat|rocky|alma|oracle linux/i)
  ) {
    release = "centos";
  } else if (procVersion.match(/arch/i)) {
    release = "arch";
  } else {
    $.logError(`${red}未检测到系统版本，请联系脚本作者！${plain}\n`);
    exit(1);
  }

  arch = await $`uname -m`.text();
  arch = arch.trim();

  if (["x86_64", "x64", "amd64"].includes(arch)) {
    arch = "64";
  } else if (["aarch64", "arm64"].includes(arch)) {
    arch = "arm64-v8a";
  } else if (arch === "s390x") {
    arch = "s390x";
  } else {
    arch = "64";
    $.logError(`${red}检测架构失败，使用默认架构: ${arch}${plain}`);
  }
  $.log(`架构: ${arch}`);

  // os version
  if (osRelease) {
    const match = osRelease.match(/VERSION_ID="?([^"]+)"?/);
    if (match) {
      os_version = match[1];
    }
  }

  if (!os_version && (await $.path("/etc/lsb-release").exists())) {
    const lsbRelease = await fs.readFile("/etc/lsb-release", "utf-8");
    const match = lsbRelease.match(/DISTRIB_RELEASE=([0-9.]+)/);
    if (match) {
      os_version = match[1];
    }
  }


  if (release === "centos") {
    const version = parseInt(os_version);
    if (version <= 6) {
      $.logError(`${red}请使用 CentOS 7 或更高版本的系统！${plain}\n`);
      exit(1);
    }
    if (version === 7) {
      $.logWarn(`${red}注意： CentOS 7 无法使用hysteria1/2协议！${plain}\n`);
    }
  } else if (release === "ubuntu") {
    if (parseInt(os_version) < 16) {
      $.logError(`${red}请使用 Ubuntu 16 或更高版本的系统！${plain}\n`);
      exit(1);
    }
  } else if (release === "debian") {
    if (parseInt(os_version) < 8) {
      $.logError(`${red}请使用 Debian 8 或更高版本的系统！${plain}\n`);
      exit(1);
    }
  }

  return {
    release,
    arch,
    os_version,
  };
}

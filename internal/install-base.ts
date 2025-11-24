import { $ } from "@david/dax";
import { cwd, exit, getuid } from "node:process";
import { osInfo } from "./os-info.ts";

const red = "\x1b[0;31m";
const plain = "\x1b[0m";

// check os
const { release, arch, os_version } = await osInfo();

export async function install_base() {
  if (release === "centos") {
    await $`yum install epel-release wget curl unzip tar crontabs socat ca-certificates -y`
      .quiet();
    await $`update-ca-trust force-enable`.quiet();
  } else if (release === "alpine") {
    await $`apk add wget curl unzip tar socat ca-certificates`.quiet();
    await $`update-ca-certificates`.quiet();
  } else if (release === "debian") {
    await $`apt-get update -y`.quiet();
    await $`apt install wget curl unzip tar cron socat ca-certificates -y`
      .quiet();
    await $`update-ca-certificates`.quiet();
  } else if (release === "ubuntu") {
    await $`apt-get update -y`.quiet();
    await $`apt install wget curl unzip tar cron socat -y`.quiet();
    await $`apt-get install ca-certificates wget -y`.quiet();
    await $`update-ca-certificates`.quiet();
  } else if (release === "arch") {
    await $`pacman -Sy --noconfirm`.quiet();
    await $`pacman -S --noconfirm --needed wget curl unzip tar cron socat`
      .quiet();
    await $`pacman -S --noconfirm --needed ca-certificates wget`.quiet();
  }
}

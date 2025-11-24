import { $ } from "@david/dax";
import { osInfo } from "./os-info.ts";

const red = "\x1b[0;31m";
const plain = "\x1b[0m";


// check os
const { release, arch, os_version } = await osInfo();

// 0: running, 1: not running, 2: not installed
export async function check_status() {
  if (!(await $.path("/usr/local/V2bX/V2bX").exists())) {
    return 2;
  }
  if (release === "alpine") {
    const temp = await $`service V2bX status`.text();
    if (temp.includes("started")) {
      return 0;
    } else {
      return 1;
    }
  } else {
    try {
      const temp = await $`systemctl status V2bX`.text();
      if (temp.includes("Active: active (running)")) {
        return 0;
      } else {
        return 1;
      }
    } catch {
      return 1;
    }
  }
}


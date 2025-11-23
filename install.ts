import { $ } from "dax-sh";
import { cwd, exit, argv, arch as nodeArch, getuid } from 'node:process';
import * as process from 'node:process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
// const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

const cur_dir = cwd();

// check root
if (getuid && getuid() !== 0) {
    $.logError(`${red}错误：${plain} 必须使用root用户运行此脚本！\n`);
    exit(1);
}

// check os
let release = "";
const osRelease = await fs.readFile("/etc/os-release", "utf-8").catch(() => "");
const issue = await fs.readFile("/etc/issue", "utf-8").catch(() => "");
const procVersion = await fs.readFile("/proc/version", "utf-8").catch(() => "");

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
} else if (procVersion.match(/centos|red hat|redhat|rocky|alma|oracle linux/i)) {
    release = "centos";
} else if (procVersion.match(/arch/i)) {
    release = "arch";
} else {
    $.logError(`${red}未检测到系统版本，请联系脚本作者！${plain}\n`);
    exit(1);
}

let arch: string = nodeArch;
if (arch === "x64") {
    arch = "64";
} else if (arch === "arm64") {
    arch = "arm64-v8a";
} else {
    arch = "64";
    $.logError(`${red}检测架构失败，使用默认架构: ${arch}${plain}`);
}

$.log(`架构: ${arch}`);

// os version
let os_version = "";
if (osRelease) {
    const match = osRelease.match(/VERSION_ID="?([^"]+)"?/);
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

async function install_base() {
    if (release === "centos") {
        await $`yum install epel-release wget curl unzip tar crontabs socat ca-certificates -y`.quiet();
        await $`update-ca-trust force-enable`.quiet();
    } else if (release === "alpine") {
        await $`apk add wget curl unzip tar socat ca-certificates`.quiet();
        await $`update-ca-certificates`.quiet();
    } else if (release === "debian") {
        await $`apt-get update -y`.quiet();
        await $`apt install wget curl unzip tar cron socat ca-certificates -y`.quiet();
        await $`update-ca-certificates`.quiet();
    } else if (release === "ubuntu") {
        await $`apt-get update -y`.quiet();
        await $`apt install wget curl unzip tar cron socat -y`.quiet();
        await $`apt-get install ca-certificates wget -y`.quiet();
        await $`update-ca-certificates`.quiet();
    } else if (release === "arch") {
        await $`pacman -Sy --noconfirm`.quiet();
        await $`pacman -S --noconfirm --needed wget curl unzip tar cron socat`.quiet();
        await $`pacman -S --noconfirm --needed ca-certificates wget`.quiet();
    }
}

// 0: running, 1: not running, 2: not installed
async function check_status() {
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

async function install_V2bX(version?: string) {
    if (await $.path("/usr/local/V2bX/").exists()) {
        await $`rm -rf /usr/local/V2bX/`;
    }

    await $`mkdir /usr/local/V2bX/ -p`;
    process.chdir("/usr/local/V2bX/");

    let last_version = version;
    if (!last_version) {
        const releaseData = await $.request("https://api.github.com/repos/wyx2685/V2bX/releases/latest").json();
        last_version = releaseData.tag_name;
        if (!last_version) {
            $.logError(`${red}检测 V2bX 版本失败，可能是超出 Github API 限制，请稍后再试，或手动指定 V2bX 版本安装${plain}`);
            exit(1);
        }
        $.log(`检测到 V2bX 最新版本：${last_version}，开始安装`);
        await $`wget --no-check-certificate -N --progress=bar -O /usr/local/V2bX/V2bX-linux.zip https://github.com/wyx2685/V2bX/releases/download/${last_version}/V2bX-linux-${arch}.zip`;
    } else {
        const url = `https://github.com/wyx2685/V2bX/releases/download/${last_version}/V2bX-linux-${arch}.zip`;
        $.log(`开始安装 V2bX ${last_version}`);
        await $`wget --no-check-certificate -N --progress=bar -O /usr/local/V2bX/V2bX-linux.zip ${url}`;
    }

    if (!(await $.path("V2bX-linux.zip").exists())) {
        $.logError(`${red}下载 V2bX 失败，请确保你的服务器能够下载 Github 的文件${plain}`);
        exit(1);
    }

    await $`unzip V2bX-linux.zip`;
    await $`rm V2bX-linux.zip -f`;
    await $`chmod +x V2bX`;
    await $`mkdir /etc/V2bX/ -p`;
    await $`cp geoip.dat /etc/V2bX/`;
    await $`cp geosite.dat /etc/V2bX/`;

    if (release === "alpine") {
        await $`rm /etc/init.d/V2bX -f`;
        const initScript = `#!/sbin/openrc-run

name="V2bX"
description="V2bX"

command="/usr/local/V2bX/V2bX"
command_args="server"
command_user="root"

pidfile="/run/V2bX.pid"
command_background="yes"

depend() {
        need net
}
`;
        await fs.writeFile("/etc/init.d/V2bX", initScript);
        await $`chmod +x /etc/init.d/V2bX`;
        await $`rc-update add V2bX default`;
        $.log(`${green}V2bX ${last_version}${plain} 安装完成，已设置开机自启`);
    } else {
        await $`rm /etc/systemd/system/V2bX.service -f`;
        const serviceFile = `[Unit]
Description=V2bX Service
After=network.target nss-lookup.target
Wants=network.target

[Service]
User=root
Group=root
Type=simple
LimitAS=infinity
LimitRSS=infinity
LimitCORE=infinity
LimitNOFILE=999999
WorkingDirectory=/usr/local/V2bX/
ExecStart=/usr/local/V2bX/V2bX server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
`;
        await fs.writeFile("/etc/systemd/system/V2bX.service", serviceFile);
        await $`systemctl daemon-reload`;
        await $`systemctl stop V2bX`;
        await $`systemctl enable V2bX`;
        $.log(`${green}V2bX ${last_version}${plain} 安装完成，已设置开机自启`);
    }

    let first_install = false;
    if (!(await $.path("/etc/V2bX/config.json").exists())) {
        await $`cp config.json /etc/V2bX/`;
        $.log("");
        $.log("全新安装，请先参看教程：https://v2bx.v-50.me/，配置必要的内容");
        first_install = true;
    } else {
        if (release === "alpine") {
            await $`service V2bX start`;
        } else {
            await $`systemctl start V2bX`;
        }
        await $.sleep(2000);
        const status = await check_status();
        $.log("");
        if (status === 0) {
            $.log(`${green}V2bX 重启成功${plain}`);
        } else {
            $.logError(`${red}V2bX 可能启动失败，请稍后使用 V2bX log 查看日志信息，若无法启动，则可能更改了配置格式，请前往 wiki 查看：https://github.com/V2bX-project/V2bX/wiki${plain}`);
        }
        first_install = false;
    }

    if (!(await $.path("/etc/V2bX/dns.json").exists())) {
        await $`cp dns.json /etc/V2bX/`;
    }
    if (!(await $.path("/etc/V2bX/route.json").exists())) {
        await $`cp route.json /etc/V2bX/`;
    }
    if (!(await $.path("/etc/V2bX/custom_outbound.json").exists())) {
        await $`cp custom_outbound.json /etc/V2bX/`;
    }
    if (!(await $.path("/etc/V2bX/custom_inbound.json").exists())) {
        await $`cp custom_inbound.json /etc/V2bX/`;
    }

    // In TS version we don't download the shell script again, we assume the TS script is the entry point.
    // But for compatibility with the original script logic which puts V2bX command in path:
    // We can create a wrapper script or symlink if needed. 
    // For now, let's just skip downloading the shell script and assume the user will use the TS script.

    process.chdir(cur_dir);
    // await $`rm -f install.sh`; // Don't delete the source file in this conversion

    $.log("");
    $.log("V2bX 管理脚本使用方法 (兼容使用V2bX执行，大小写不敏感): ");
    $.log("------------------------------------------");
    $.log("V2bX              - 显示管理菜单 (功能更多)");
    $.log("V2bX start        - 启动 V2bX");
    $.log("V2bX stop         - 停止 V2bX");
    $.log("V2bX restart      - 重启 V2bX");
    $.log("V2bX status       - 查看 V2bX 状态");
    $.log("V2bX enable       - 设置 V2bX 开机自启");
    $.log("V2bX disable      - 取消 V2bX 开机自启");
    $.log("V2bX log          - 查看 V2bX 日志");
    $.log("V2bX x25519       - 生成 x25519 密钥");
    $.log("V2bX generate     - 生成 V2bX 配置文件");
    $.log("V2bX update       - 更新 V2bX");
    $.log("V2bX update x.x.x - 更新 V2bX 指定版本");
    $.log("V2bX install      - 安装 V2bX");
    $.log("V2bX uninstall    - 卸载 V2bX");
    $.log("V2bX version      - 查看 V2bX 版本");
    $.log("------------------------------------------");

    if (first_install) {
        const if_generate = await $.prompt("检测到你为第一次安装V2bX,是否自动直接生成配置文件？(y/n): ", { default: "y" });
        if (if_generate.toLowerCase() === "y") {
            // We will need to call the initconfig logic here. 
            // Since we are converting initconfig.sh to initconfig.ts, we can import it or run it.
            // For now, let's assume we run it via deno.
            // await $`deno run -A initconfig.ts`;
            $.log("Please run initconfig.ts manually or convert it to Node.js as well.");
        }
    }
}

if (argv[1] === fileURLToPath(import.meta.url)) {
    $.log(`${green}开始安装${plain}`);
    await install_base();
    await install_V2bX(argv[2]);
}

export { install_V2bX, install_base, check_status, release };

#!/usr/bin/env -S deno run --allow-all

import { $ } from "@david/dax";
import * as process from "node:process";
import { argv, exit } from "node:process";
import * as fs from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

async function check_ipv6_support(): Promise<boolean> {
    try {
        const output = await $`ip -6 addr`.text();
        return output.includes("inet6");
    } catch {
        return false;
    }
}

let nodes_config: string[] = [];
let cores_config_list: any[] = [];
let core_xray = false;
let core_sing = false;
let core_hysteria2 = false;

// Shared variables for fixed API info
let fixed_api_info = false;
let global_ApiHost = "";
let global_ApiKey = "";

async function add_node_config() {
    $.log(`${green}请选择节点核心类型：${plain}`);
    $.log(`${green}1. xray${plain}`);
    $.log(`${green}2. singbox${plain}`);
    $.log(`${green}3. hysteria2${plain}`);

    const core_type = await $.prompt("请输入：");
    let core = "";

    if (core_type === "1") {
        core = "xray";
        core_xray = true;
    } else if (core_type === "2") {
        core = "sing";
        core_sing = true;
    } else if (core_type === "3") {
        core = "hysteria2";
        core_hysteria2 = true;
    } else {
        $.logError("无效的选择。请选择 1 2 3。");
        return;
    }

    let NodeID = "";
    while (true) {
        NodeID = await $.prompt("请输入节点Node ID：");
        if (/^[0-9]+$/.test(NodeID)) {
            break;
        } else {
            $.logError("错误：请输入正确的数字作为Node ID。");
        }
    }

    let NodeType = "";
    if (core_hysteria2 && !core_xray && !core_sing) {
        NodeType = "hysteria2";
    } else {
        $.log(`${yellow}请选择节点传输协议：${plain}`);
        $.log(`${green}1. Shadowsocks${plain}`);
        $.log(`${green}2. Vless${plain}`);
        $.log(`${green}3. Vmess${plain}`);
        if (core_sing) {
            $.log(`${green}4. Hysteria${plain}`);
            $.log(`${green}5. Hysteria2${plain}`);
        }
        if (core_hysteria2 && !core_sing) {
            $.log(`${green}5. Hysteria2${plain}`);
        }
        $.log(`${green}6. Trojan${plain}`);
        if (core_sing) {
            $.log(`${green}7. Tuic${plain}`);
            $.log(`${green}8. AnyTLS${plain}`);
        }

        const typeSelection = await $.prompt("请输入：");
        switch (typeSelection) {
            case "1":
                NodeType = "shadowsocks";
                break;
            case "2":
                NodeType = "vless";
                break;
            case "3":
                NodeType = "vmess";
                break;
            case "4":
                NodeType = "hysteria";
                break;
            case "5":
                NodeType = "hysteria2";
                break;
            case "6":
                NodeType = "trojan";
                break;
            case "7":
                NodeType = "tuic";
                break;
            case "8":
                NodeType = "anytls";
                break;
            default:
                NodeType = "shadowsocks";
                break;
        }
    }

    let fastopen = true;
    let isreality = "n";
    let istls = "n";

    if (NodeType === "vless") {
        isreality = await $.prompt("请选择是否为reality节点？(y/n)", {
            default: "n",
        });
    } else if (["hysteria", "hysteria2", "tuic", "anytls"].includes(NodeType)) {
        fastopen = false;
        istls = "y";
    }

    if (isreality.toLowerCase() !== "y" && istls.toLowerCase() !== "y") {
        istls = await $.prompt("请选择是否进行TLS配置？(y/n)", { default: "n" });
    }

    let certmode = "none";
    let certdomain = "example.com";

    if (isreality.toLowerCase() !== "y" && istls.toLowerCase() === "y") {
        $.log(`${yellow}请选择证书申请模式：${plain}`);
        $.log(`${green}1. http模式自动申请，节点域名已正确解析${plain}`);
        $.log(`${green}2. dns模式自动申请，需填入正确域名服务商API参数${plain}`);
        $.log(`${green}3. self模式，自签证书或提供已有证书文件${plain}`);

        const modeSelection = await $.prompt("请输入：");
        switch (modeSelection) {
            case "1":
                certmode = "http";
                break;
            case "2":
                certmode = "dns";
                break;
            case "3":
                certmode = "self";
                break;
        }

        certdomain = await $.prompt("请输入节点证书域名(example.com)：");
        if (certmode !== "http") {
            $.logError(`${red}请手动修改配置文件后重启V2bX！${plain}`);
        }
    }

    const ipv6_support = await check_ipv6_support();
    let listen_ip = "0.0.0.0";
    if (ipv6_support) {
        listen_ip = "::";
    }

    let node_config: any = {};

    // Use global API info if fixed, otherwise ask or use what was just entered (logic handled in caller loop, but here we need values)
    // Actually the original script logic asks for ApiHost/ApiKey in the loop BEFORE calling add_node_config,
    // but add_node_config uses the variables.

    if (core_type === "1") {
        node_config = {
            "Core": core,
            "ApiHost": global_ApiHost,
            "ApiKey": global_ApiKey,
            "NodeID": parseInt(NodeID),
            "NodeType": NodeType,
            "Timeout": 30,
            "ListenIP": "0.0.0.0",
            "SendIP": "0.0.0.0",
            "DeviceOnlineMinTraffic": 200,
            "MinReportTraffic": 0,
            "EnableProxyProtocol": false,
            "EnableUot": true,
            "EnableTFO": true,
            "DNSType": "UseIPv4",
            "CertConfig": {
                "CertMode": certmode,
                "RejectUnknownSni": false,
                "CertDomain": certdomain,
                "CertFile": "/etc/V2bX/fullchain.cer",
                "KeyFile": "/etc/V2bX/cert.key",
                "Email": "v2bx@github.com",
                "Provider": "cloudflare",
                "DNSEnv": {
                    "EnvName": "env1",
                },
            },
        };
    } else if (core_type === "2") {
        node_config = {
            "Core": core,
            "ApiHost": global_ApiHost,
            "ApiKey": global_ApiKey,
            "NodeID": parseInt(NodeID),
            "NodeType": NodeType,
            "Timeout": 30,
            "ListenIP": listen_ip,
            "SendIP": "0.0.0.0",
            "DeviceOnlineMinTraffic": 200,
            "MinReportTraffic": 0,
            "TCPFastOpen": fastopen,
            "SniffEnabled": true,
            "CertConfig": {
                "CertMode": certmode,
                "RejectUnknownSni": false,
                "CertDomain": certdomain,
                "CertFile": "/etc/V2bX/fullchain.cer",
                "KeyFile": "/etc/V2bX/cert.key",
                "Email": "v2bx@github.com",
                "Provider": "cloudflare",
                "DNSEnv": {
                    "EnvName": "env1",
                },
            },
        };
    } else if (core_type === "3") {
        node_config = {
            "Core": core,
            "ApiHost": global_ApiHost,
            "ApiKey": global_ApiKey,
            "NodeID": parseInt(NodeID),
            "NodeType": NodeType,
            "Hysteria2ConfigPath": "/etc/V2bX/hy2config.yaml",
            "Timeout": 30,
            "ListenIP": "",
            "SendIP": "0.0.0.0",
            "DeviceOnlineMinTraffic": 200,
            "MinReportTraffic": 0,
            "CertConfig": {
                "CertMode": certmode,
                "RejectUnknownSni": false,
                "CertDomain": certdomain,
                "CertFile": "/etc/V2bX/fullchain.cer",
                "KeyFile": "/etc/V2bX/cert.key",
                "Email": "v2bx@github.com",
                "Provider": "cloudflare",
                "DNSEnv": {
                    "EnvName": "env1",
                },
            },
        };
    }
    nodes_config.push(JSON.stringify(node_config, null, 4));
}

export async function generate_config_file() {
    $.log(`${yellow}V2bX 配置文件生成向导${plain}`);
    $.log(`${red}请阅读以下注意事项：${plain}`);
    $.log(`${red}1. 目前该功能正处测试阶段${plain}`);
    $.log(`${red}2. 生成的配置文件会保存到 /etc/V2bX/config.json${plain}`);
    $.log(`${red}3. 原来的配置文件会保存到 /etc/V2bX/config.json.bak${plain}`);
    $.log(`${red}4. 目前仅部分支持TLS${plain}`);
    $.log(`${red}5. 使用此功能生成的配置文件会自带审计，确定继续？(y/n)${plain}`);

    const continue_prompt = await $.prompt("请输入：", { default: "n" });
    if (continue_prompt.match(/^[Nn][Oo]?/)) {
        exit(0);
    }

    let first_node = true;

    while (true) {
        if (first_node) {
            global_ApiHost = await $.prompt("请输入机场网址(https://example.com)：");
            global_ApiKey = await $.prompt("请输入面板对接API Key：");
            const fixed_api = await $.prompt(
                "是否设置固定的机场网址和API Key？(y/n)",
                { default: "n" },
            );

            if (fixed_api.toLowerCase() === "y") {
                fixed_api_info = true;
                $.log(`${red}成功固定地址${plain}`);
            }
            first_node = false;
            await add_node_config();
        } else {
            const continue_adding_node = await $.prompt(
                "是否继续添加节点配置？(回车继续，输入n或no退出)",
                { default: "y" },
            );
            if (continue_adding_node.match(/^[Nn][Oo]?/)) {
                break;
            } else if (!fixed_api_info) {
                global_ApiHost = await $.prompt(
                    "请输入机场网址(https://example.com)：",
                );
                global_ApiKey = await $.prompt("请输入面板对接API Key：");
            }
            await add_node_config();
        }
    }

    // Core configs
    if (core_xray) {
        cores_config_list.push({
            "Type": "xray",
            "Log": {
                "Level": "error",
                "ErrorPath": "/etc/V2bX/error.log",
            },
            "OutboundConfigPath": "/etc/V2bX/custom_outbound.json",
            "RouteConfigPath": "/etc/V2bX/route.json",
        });
    }

    if (core_sing) {
        cores_config_list.push({
            "Type": "sing",
            "Log": {
                "Level": "error",
                "Timestamp": true,
            },
            "NTP": {
                "Enable": false,
                "Server": "time.apple.com",
                "ServerPort": 0,
            },
            "OriginalPath": "/etc/V2bX/sing_origin.json",
        });
    }

    if (core_hysteria2) {
        cores_config_list.push({
            "Type": "hysteria2",
            "Log": {
                "Level": "error",
            },
        });
    }

    process.chdir("/etc/V2bX");
    if (await $.path("config.json").exists()) {
        await $.path("config.json").rename("config.json.bak");
    }

    const finalConfig = {
        "Log": {
            "Level": "error",
            "Output": "",
        },
        "Cores": cores_config_list,
        "Nodes": nodes_config.map((n) => JSON.parse(n)),
    };

    await fs.writeFile(
        "/etc/V2bX/config.json",
        JSON.stringify(finalConfig, null, 4),
    );

    const customOutbound = [
        {
            "tag": "IPv4_out",
            "protocol": "freedom",
            "settings": {
                "domainStrategy": "UseIPv4v6",
            },
        },
        {
            "tag": "IPv6_out",
            "protocol": "freedom",
            "settings": {
                "domainStrategy": "UseIPv6",
            },
        },
        {
            "protocol": "blackhole",
            "tag": "block",
        },
    ];
    await fs.writeFile(
        "/etc/V2bX/custom_outbound.json",
        JSON.stringify(customOutbound, null, 4),
    );

    const routeConfig = {
        "domainStrategy": "AsIs",
        "rules": [
            {
                "type": "field",
                "outboundTag": "block",
                "ip": [
                    "geoip:private",
                ],
            },
            {
                "type": "field",
                "outboundTag": "block",
                "domain": [
                    "regexp:(api|ps|sv|offnavi|newvector|ulog.imap|newloc)(.map|).(baidu|n.shifen).com",
                    "regexp:(.+.|^)(360|so).(cn|com)",
                    "regexp:(Subject|HELO|SMTP)",
                    "regexp:(torrent|.torrent|peer_id=|info_hash|get_peers|find_node|BitTorrent|announce_peer|announce.php?passkey=)",
                    "regexp:(^.@)(guerrillamail|guerrillamailblock|sharklasers|grr|pokemail|spam4|bccto|chacuo|027168).(info|biz|com|de|net|org|me|la)",
                    "regexp:(.?)(xunlei|sandai|Thunder|XLLiveUD)(.)",
                    "regexp:(..||)(dafahao|mingjinglive|botanwang|minghui|dongtaiwang|falunaz|epochtimes|ntdtv|falundafa|falungong|wujieliulan|zhengjian).(org|com|net)",
                    "regexp:(ed2k|.torrent|peer_id=|announce|info_hash|get_peers|find_node|BitTorrent|announce_peer|announce.php?passkey=|magnet:|xunlei|sandai|Thunder|XLLiveUD|bt_key)",
                    "regexp:(.+.|^)(360).(cn|com|net)",
                    "regexp:(.*.||)(guanjia.qq.com|qqpcmgr|QQPCMGR)",
                    "regexp:(.*.||)(rising|kingsoft|duba|xindubawukong|jinshanduba).(com|net|org)",
                    "regexp:(.*.||)(netvigator|torproject).(com|cn|net|org)",
                    "regexp:(..||)(visa|mycard|gash|beanfun|bank).",
                    "regexp:(.*.||)(gov|12377|12315|talk.news.pts.org|creaders|zhuichaguoji|efcc.org|cyberpolice|aboluowang|tuidang|epochtimes|zhengjian|110.qq|mingjingnews|inmediahk|xinsheng|breakgfw|chengmingmag|jinpianwang|qi-gong|mhradio|edoors|renminbao|soundofhope|xizang-zhiye|bannedbook|ntdtv|12321|secretchina|dajiyuan|boxun|chinadigitaltimes|dwnews|huaglad|oneplusnews|epochweekly|cn.rfi).(cn|com|org|net|club|net|fr|tw|hk|eu|info|me)",
                    "regexp:(.*.||)(miaozhen|cnzz|talkingdata|umeng).(cn|com)",
                    "regexp:(.*.||)(mycard).(com|tw)",
                    "regexp:(.*.||)(gash).(com|tw)",
                    "regexp:(.bank.)",
                    "regexp:(.*.||)(pincong).(rocks)",
                    "regexp:(.*.||)(taobao).(com)",
                    "regexp:(.*.||)(laomoe|jiyou|ssss|lolicp|vv1234|0z|4321q|868123|ksweb|mm126).(com|cloud|fun|cn|gs|xyz|cc)",
                    "regexp:(flows|miaoko).(pages).(dev)",
                ],
            },
            {
                "type": "field",
                "outboundTag": "block",
                "ip": [
                    "127.0.0.1/32",
                    "10.0.0.0/8",
                    "fc00::/7",
                    "fe80::/10",
                    "172.16.0.0/12",
                ],
            },
            {
                "type": "field",
                "outboundTag": "block",
                "protocol": [
                    "bittorrent",
                ],
            },
            {
                "type": "field",
                "outboundTag": "IPv4_out",
                "network": "udp,tcp",
            },
        ],
    };
    await fs.writeFile(
        "/etc/V2bX/route.json",
        JSON.stringify(routeConfig, null, 4),
    );

    const ipv6_support = await check_ipv6_support();
    let dnsstrategy = "ipv4_only";
    if (ipv6_support) {
        dnsstrategy = "prefer_ipv4";
    }

    const singOrigin = {
        "dns": {
            "servers": [
                {
                    "tag": "cf",
                    "address": "1.1.1.1",
                },
            ],
            "strategy": dnsstrategy,
        },
        "outbounds": [
            {
                "tag": "direct",
                "type": "direct",
                "domain_resolver": {
                    "server": "cf",
                    "strategy": dnsstrategy,
                },
            },
            {
                "type": "block",
                "tag": "block",
            },
        ],
        "route": {
            "rules": [
                {
                    "ip_is_private": true,
                    "outbound": "block",
                },
                {
                    "domain_regex": [
                        "(api|ps|sv|offnavi|newvector|ulog.imap|newloc)(.map|).(baidu|n.shifen).com",
                        "(.+.|^)(360|so).(cn|com)",
                        "(Subject|HELO|SMTP)",
                        "(torrent|.torrent|peer_id=|info_hash|get_peers|find_node|BitTorrent|announce_peer|announce.php?passkey=)",
                        "(^.@)(guerrillamail|guerrillamailblock|sharklasers|grr|pokemail|spam4|bccto|chacuo|027168).(info|biz|com|de|net|org|me|la)",
                        "(.?)(xunlei|sandai|Thunder|XLLiveUD)(.)",
                        "(..||)(dafahao|mingjinglive|botanwang|minghui|dongtaiwang|falunaz|epochtimes|ntdtv|falundafa|falungong|wujieliulan|zhengjian).(org|com|net)",
                        "(ed2k|.torrent|peer_id=|announce|info_hash|get_peers|find_node|BitTorrent|announce_peer|announce.php?passkey=|magnet:|xunlei|sandai|Thunder|XLLiveUD|bt_key)",
                        "(.+.|^)(360).(cn|com|net)",
                        "(.*.||)(guanjia.qq.com|qqpcmgr|QQPCMGR)",
                        "(.*.||)(rising|kingsoft|duba|xindubawukong|jinshanduba).(com|net|org)",
                        "(.*.||)(netvigator|torproject).(com|cn|net|org)",
                        "(..||)(visa|mycard|gash|beanfun|bank).",
                        "(.*.||)(gov|12377|12315|talk.news.pts.org|creaders|zhuichaguoji|efcc.org|cyberpolice|aboluowang|tuidang|epochtimes|zhengjian|110.qq|mingjingnews|inmediahk|xinsheng|breakgfw|chengmingmag|jinpianwang|qi-gong|mhradio|edoors|renminbao|soundofhope|xizang-zhiye|bannedbook|ntdtv|12321|secretchina|dajiyuan|boxun|chinadigitaltimes|dwnews|huaglad|oneplusnews|epochweekly|cn.rfi).(cn|com|org|net|club|net|fr|tw|hk|eu|info|me)",
                        "(.*.||)(miaozhen|cnzz|talkingdata|umeng).(cn|com)",
                        "(.*.||)(mycard).(com|tw)",
                        "(.*.||)(gash).(com|tw)",
                        "(.bank.)",
                        "(.*.||)(pincong).(rocks)",
                        "(.*.||)(taobao).(com)",
                        "(.*.||)(laomoe|jiyou|ssss|lolicp|vv1234|0z|4321q|868123|ksweb|mm126).(com|cloud|fun|cn|gs|xyz|cc)",
                        "(flows|miaoko).(pages).(dev)",
                    ],
                    "outbound": "block",
                },
                {
                    "outbound": "direct",
                    "network": [
                        "udp",
                        "tcp",
                    ],
                },
            ],
        },
        "experimental": {
            "cache_file": {
                "enabled": true,
            },
        },
    };
    await fs.writeFile(
        "/etc/V2bX/sing_origin.json",
        JSON.stringify(singOrigin, null, 4),
    );

    const hy2config = `quic:
  initStreamReceiveWindow: 8388608
  maxStreamReceiveWindow: 8388608
  initConnReceiveWindow: 20971520
  maxConnReceiveWindow: 20971520
  maxIdleTimeout: 30s
  maxIncomingStreams: 1024
  disablePathMTUDiscovery: false
ignoreClientBandwidth: false
disableUDP: false
udpIdleTimeout: 60s
resolver:
  type: system
acl:
  inline:
    - direct(geosite:google)
    - reject(geosite:cn)
    - reject(geoip:cn)
masquerade:
  type: 404
`;
    await fs.writeFile("/etc/V2bX/hy2config.yaml", hy2config);

    $.log(`${green}V2bX 配置文件生成完成,正在重新启动服务${plain}`);
    // Assuming v2bx command is available or we can call the service
    try {
        await $`v2bx restart`;
    } catch {
        // fallback to systemctl/service if v2bx alias not present
        if (await $.path("/etc/init.d/V2bX").exists()) {
            await $`service V2bX restart`;
        } else {
            await $`systemctl restart V2bX`;
        }
    }
}

const currentPath = realpathSync(fileURLToPath(import.meta.url));
const mainPath = realpathSync(argv[1]);

if (currentPath == mainPath) {
    await generate_config_file();
}

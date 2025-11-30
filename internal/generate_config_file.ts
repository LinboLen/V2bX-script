import { $ } from "@david/dax";
import * as process from "node:process";
import { exit } from "node:process";
import * as fs from "node:fs/promises";
import { check_ipv6_support } from "./check_ipv6_support.ts";
import { add_node_config } from "./add_node_config.ts";
import { CoreConfig, GlobalConfig } from "./config.ts";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

export async function generate_config_file(
  coreConfig: CoreConfig = {
    core_xray: false,
    core_sing: false,
    core_hysteria2: false,
  },
) {
  let nodes_config: string[] = [];
  let cores_config_list: any[] = [];

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
  // Shared variables for fixed API info
  let fixed_api_info = false;

  while (true) {
    if (first_node) {
      GlobalConfig.ApiHost = await $.prompt(
        "请输入机场网址(https://example.com)：",
      );
      GlobalConfig.ApiKey = await $.prompt("请输入面板对接API Key：");
      const fixed_api = await $.prompt(
        "是否设置固定的机场网址和API Key？(y/n)",
        { default: "n" },
      );

      if (fixed_api.toLowerCase() === "y") {
        fixed_api_info = true;
        $.log(`${red}成功固定地址${plain}`);
      }
      first_node = false;
      nodes_config.push(await add_node_config(coreConfig));
    } else {
      const continue_adding_node = await $.prompt(
        "是否继续添加节点配置？(回车继续，输入n或no退出)",
        { default: "y" },
      );
      if (continue_adding_node.match(/^[Nn][Oo]?/)) {
        break;
      } else if (!fixed_api_info) {
        GlobalConfig.ApiHost = await $.prompt(
          "请输入机场网址(https://example.com)：",
        );
        GlobalConfig.ApiKey = await $.prompt("请输入面板对接API Key：");
      }
      nodes_config.push(await add_node_config(coreConfig));
    }
  }

  // Core configs
  if (coreConfig.core_xray) {
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

  if (coreConfig.core_sing) {
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

  if (coreConfig.core_hysteria2) {
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
    "Nodes": nodes_config,
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

  const restartService = await $.prompt(
    `${green}V2bX 配置文件生成完成,是否重新启动服务${plain}y/Nn?`,
    { default: "y" },
  );

  if (restartService.toLowerCase() === "y") {
    $.log(`${green}正在重新启动服务${plain}`);
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
}

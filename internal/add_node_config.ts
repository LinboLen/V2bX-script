import { $ } from "@david/dax";
import { check_ipv6_support } from "./check_ipv6_support.ts";
import { CoreConfig, GlobalConfig } from "./config.ts";

const red = "\x1b[0;31m";
const green = "\x1b[0;32m";
const yellow = "\x1b[0;33m";
const plain = "\x1b[0m";

export async function add_node_config(coreConfig: CoreConfig) {
  $.log(`${green}请选择节点核心类型：${plain}`);
  $.log(`${green}1. xray${plain}`);
  $.log(`${green}2. singbox${plain}`);
  $.log(`${green}3. hysteria2${plain}`);

  const core_type = await $.prompt("请输入：");
  let core = "";

  if (core_type === "1") {
    core = "xray";
    coreConfig.core_xray = true;
  } else if (core_type === "2") {
    core = "sing";
    coreConfig.core_sing = true;
  } else if (core_type === "3") {
    core = "hysteria2";
    coreConfig.core_hysteria2 = true;
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
  if (coreConfig.core_hysteria2 && !coreConfig.core_xray && !coreConfig.core_sing) {
    NodeType = "hysteria2";
  } else {
    $.log(`${yellow}请选择节点传输协议：${plain}`);
    $.log(`${green}1. Shadowsocks${plain}`);
    $.log(`${green}2. Vless${plain}`);
    $.log(`${green}3. Vmess${plain}`);
    if (coreConfig.core_sing) {
      $.log(`${green}4. Hysteria${plain}`);
      $.log(`${green}5. Hysteria2${plain}`);
    }
    if (coreConfig.core_hysteria2 && !coreConfig.core_sing) {
      $.log(`${green}5. Hysteria2${plain}`);
    }
    $.log(`${green}6. Trojan${plain}`);
    if (coreConfig.core_sing) {
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
      "ApiHost": GlobalConfig.ApiHost,
      "ApiKey": GlobalConfig.ApiKey,
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
      "ApiHost": GlobalConfig.ApiHost,
      "ApiKey": GlobalConfig.ApiKey,
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
      "ApiHost": GlobalConfig.ApiHost,
      "ApiKey": GlobalConfig.ApiKey,
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
  return node_config;
}

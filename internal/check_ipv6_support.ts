import { $ } from "@david/dax";


export async function check_ipv6_support(): Promise<boolean> {
  try {
    const output = await $`ip -6 addr`.text();
    return output.includes("inet6");
  } catch {
    return false;
  }
}

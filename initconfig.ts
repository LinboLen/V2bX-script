#!/usr/bin/env -S deno run --allow-all

import { argv } from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generate_config_file } from "./internal/generate_config_file.ts";

const currentPath = realpathSync(fileURLToPath(import.meta.url));
const mainPath = realpathSync(argv[1]);

if (currentPath == mainPath) {
    await generate_config_file();
}

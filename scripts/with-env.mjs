#!/usr/bin/env node
/**
 * Wrapper that loads .env.local into process.env before invoking another script.
 * Usage: node scripts/with-env.mjs <script-path>
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const envFile = resolve(root, ".env.local");
const content = readFileSync(envFile, "utf8");
for (const line of content.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  // Strip optional surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/with-env.mjs <script>");
  process.exit(1);
}

const child = spawn(process.execPath, [resolve(root, target)], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
child.on("exit", (code) => process.exit(code ?? 0));
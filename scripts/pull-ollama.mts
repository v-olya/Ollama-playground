#!/usr/bin/env node

import "dotenv/config";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";

// CLI parsing: allow --model <name>
function parseArgFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

const suppliedModel = parseArgFlag("--model");

if (!suppliedModel) {
  console.error("Model is required when not using a named mode. Pass --model <model>");
  process.exit(1);
}

function pullModel(model: string): void {
  const pull: SpawnSyncReturns<Buffer> = spawnSync("ollama", ["pull", model], {
    stdio: "inherit",
  });

  if (pull.error || pull.status !== 0) {
    console.error(`Failed to execute "ollama pull ${suppliedModel}".`, pull.error || pull.status);
  }
}

pullModel(suppliedModel);

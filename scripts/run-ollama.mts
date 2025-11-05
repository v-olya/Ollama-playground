#!/usr/bin/env node

import "dotenv/config";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { URL } from "node:url";

// Simple CLI parsing: allow --model <name> and --port <port>
function parseArgFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

const suppliedModel = parseArgFlag("--model");

if (!suppliedModel) {
  process.exit(1);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable "${name}".`);
    process.exit(1);
  }
  return value;
}

const baseUrl = requiredEnv("BASE_URL");

try {
  new URL(baseUrl);
  //host = `${url.hostname}:${port}`;
} catch (error: unknown) {
  console.error(
    `Invalid BASE_URL "${baseUrl}": ${(error as Error).message ?? error}`
  );
  process.exit(1);
}

let model: string;
if (suppliedModel) {
  model = suppliedModel;
} else {
  console.error(
    "Model is required when not using a named mode. Pass --model <model>"
  );
  process.exit(1);
}

function exitWithCleanup(reason: string): never {
  console.error(`Exiting due to: ${reason}`);

  process.exit(1);
  throw new Error("Forced exit"); // Ensures type safety for `never`
}

function pullModel(): void {
  const pull: SpawnSyncReturns<Buffer> = spawnSync("ollama", ["pull", model], {
    env: process.env,
    stdio: "inherit",
  });

  if (pull.error || pull.status !== 0) {
    console.error(
      `Failed to execute "ollama pull ${model}".`,
      pull.error || pull.status
    );
    if (pull.error || pull.status !== 0) {
      exitWithCleanup(`Failed to pull model "${model}"`);
    }
  }
}

export async function waitForServer(
  hostname: string,
  timeoutMs = 30_000,
  pollMs = 500
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://${hostname}/api/version`;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        clearTimeout(timeout);
        return;
      }
    } catch {
      // Server not ready yet; keep polling.
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error("timed out waiting for server to start");
}

pullModel();
process.exit(0);

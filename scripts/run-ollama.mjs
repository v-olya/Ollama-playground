#!/usr/bin/env node

import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { URL } from "node:url";
import { createInterface } from "node:readline";

const MODES = {
  primary: {
    portEnv: "NEXT_PUBLIC_OLLAMA_PRIMARY_PORT",
    modelEnv: "NEXT_PUBLIC_OLLAMA_PRIMARY_MODEL",
  },
  secondary: {
    portEnv: "NEXT_PUBLIC_OLLAMA_SECONDARY_PORT",
    modelEnv: "NEXT_PUBLIC_OLLAMA_SECONDARY_MODEL",
  },
};

const mode = process.argv[2] ?? "primary";
const config = MODES[mode];

if (!config) {
  console.error(
    `Unknown mode "${mode}". Choose one of: ${Object.keys(MODES).join(", ")}.`
  );
  process.exit(1);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable "${name}".`);
    process.exit(1);
  }
  return value;
}

const baseUrl = requiredEnv("NEXT_PUBLIC_BASE_URL");
const port = requiredEnv(config.portEnv);
let host;

const shouldUseSystemService = process.platform === "win32" && port === "11434";

try {
  const url = new URL(baseUrl);
  host = `${url.hostname}:${port}`;
} catch (error) {
  console.error(
    `Invalid NEXT_PUBLIC_BASE_URL "${baseUrl}": ${error.message ?? error}`
  );
  process.exit(1);
}

const model = requiredEnv(config.modelEnv);
const env = { ...process.env, OLLAMA_HOST: host };

if (!process.env.OLLAMA_MODELS && mode === "secondary") {
  env.OLLAMA_MODELS = join(process.cwd(), ".ollama-secondary");
}

console.log(`Using Ollama host ${env.OLLAMA_HOST} for model "${model}".`);

let serveProcess;

function exitWithCleanup() {
  if (serveProcess && serveProcess.exitCode === null) {
    serveProcess.kill("SIGTERM");
  }
  process.exit(1);
}

function pullModel() {
  const pull = spawnSync("ollama", ["pull", model], {
    env,
    stdio: "inherit",
  });

  if (pull.error || pull.status !== 0) {
    console.error(
      `Failed to execute "ollama pull ${model}".`,
      pull.error || pull.status
    );
    exitWithCleanup();
  }
}

async function waitForServer(hostname, timeoutMs = 30_000, pollMs = 500) {
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

if (shouldUseSystemService) {
  pullModel();
  console.log(
    "Detected Windows platform; skipping `ollama serve` because the system service is already running."
  );
  process.exit(0);
}

serveProcess = spawn("ollama", ["serve"], {
  env,
  stdio: ["inherit", "pipe", "pipe"],
});

function forwardWithoutInfo(stream, write) {
  if (!stream) return;
  const rl = createInterface({ input: stream });
  rl.on("line", (line) => {
    if (!line.includes("level=INFO")) {
      write(`${line}\n`);
    }
  });
  serveProcess.on("close", () => rl.close());
}

forwardWithoutInfo(serveProcess.stdout, (line) => process.stdout.write(line));
forwardWithoutInfo(serveProcess.stderr, (line) => process.stderr.write(line));

const forwardExit = (signal) => {
  if (serveProcess.exitCode === null) {
    serveProcess.kill(signal);
  }
};

process.on("SIGINT", forwardExit);
process.on("SIGTERM", forwardExit);

try {
  await waitForServer(env.OLLAMA_HOST);
} catch (error) {
  console.error(
    `Ollama server at ${env.OLLAMA_HOST} failed to start: ${
      error.message ?? error
    }`
  );
  exitWithCleanup();
}

pullModel();

serveProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

import { spawnSync } from "node:child_process";

export type StopOutcome = "skipped" | "stopped" | "failed";

// A guard against registering cleanup handlers multiple times (on every utils import)
const HANDLERS_KEY = Symbol.for("signal_handlers_installed");
const _g = globalThis as unknown as Record<symbol | string, unknown>;
if (!_g[HANDLERS_KEY]) {
  _g[HANDLERS_KEY] = true;

  // System shutdown signal
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, stopping ollama models...");
    await stopOllamaModels();
    process.exit(0);
  });
  // User interrupt signal
  process.on("SIGINT", async () => {
    console.log("SIGINT received, stopping ollama models...");
    await stopOllamaModels();
    process.exit(0);
  });

  // A cleanup attempt for crashes using sync function (async ones probably won't run reliably)
  process.on("uncaughtException", (err) => {
    try {
      console.error("UncaughtException - attempting to stop the models:", err);
      const models = getPulledModels();
      for (const m of models) {
        try {
          const outcome = stopModel(m);
          console.log(`sync stop ${m}: ${outcome}`);
        } catch (e) {
          console.warn(`Failed to stop ${m}:`, e);
        }
      }
    } catch {
      //ignore
    } finally {
      process.exit(1); // failure
    }
  });

  process.on("unhandledRejection", (reason) => {
    try {
      console.error("UnhandledRejection - attempting to stop the models:", reason);
      const models = getPulledModels();
      for (const m of models) {
        try {
          const outcome = stopModel(m);
          console.log(`sync stop ${m}: ${outcome}`);
        } catch (e) {
          console.warn(`Failed to stop ${m}:`, e);
        }
      }
    } catch {
    } finally {
      process.exit(1);
    }
  });
}

async function stopOllamaModels(): Promise<void> {
  try {
    const models = getRunningModels();
    //or getPulledModels(): it may be redundant, but safe
    if (!models.length) return;
    console.log(`Stopping ${models.length} pulled model(s)...`);
    await Promise.all(
      models.map(async (m) => {
        try {
          const outcome = await ensureModelStopped(m);
          console.log(`stop ${m}: ${outcome}`);
        } catch (err) {
          console.warn(`Failed stopping model ${m}:`, err);
        }
      })
    );
  } catch (err) {
    console.warn("stopOllamaModels failed:", err);
  }
}

export function getPulledModels(): string[] {
  const models: string[] = [];
  const list = spawnSync("ollama", ["list"], {
    encoding: "utf8",
    env: process.env,
  });
  const raw = !list.error && typeof list.stdout === "string" ? list.stdout : "";
  if (raw) {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || (line.toLowerCase().includes("name") && line.toLowerCase().includes("id"))) continue;
      const match = line.match(/[A-Za-z0-9_\-:.]+/g);
      if (match?.length) {
        models.push(match[0]);
      }
    }
  }
  return models;
}

export function getRunningModels(): string[] {
  const models: string[] = [];
  const list = spawnSync("ollama", ["ps"], {
    encoding: "utf8",
    env: process.env,
  });
  const raw = !list.error && typeof list.stdout === "string" ? list.stdout : "";
  // Parses the first token (NAME) from each non-header row of the `ollama ps` output
  if (raw) {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.toLowerCase().includes("name") && line.toLowerCase().includes("id")) continue; // skip the header line)
      const match = line.match(/[A-Za-z0-9_.\-:]+/g); // dots, underscores, hyphens and colons
      if (match?.length) {
        models.push(match[0]);
      }
    }
  }
  return models;
}

export function isModelPulled(model: string): boolean {
  const pulledModels = getPulledModels();
  return pulledModels.includes(model);
}

export function isModelRunning(model: string): boolean {
  // not used currently
  // DOES NOT DETECT if the cloud-hosted model is "started" by 'ollama run', works for local models only
  const key = model?.trim();
  if (!key) return false;
  const running = getRunningModels();
  return running.includes(key);
}

export function stopModel(model: string): StopOutcome {
  if (!isModelPulled(model)) {
    return "skipped";
  }

  const stop = spawnSync("ollama", ["stop", model], {
    stdio: "inherit",
    env: process.env,
  });

  if (stop.error || stop.status !== 0) {
    return "failed";
  }

  return "stopped";
}

// Deduplicate stop commands so concurrent callers reuse a single process per model
const inflightStops = new Map<string, Promise<StopOutcome>>();

export async function ensureModelStopped(model: string): Promise<StopOutcome> {
  const key = model.trim();
  if (!key) {
    return "skipped";
  }

  const existing = inflightStops.get(key);
  if (existing) {
    return existing;
  }

  const stopPromise = (async () => {
    if (!isModelPulled(key)) {
      return "skipped";
    }
    return stopModel(key);
  })()
    .catch((err) => {
      inflightStops.delete(key);
      throw err;
    })
    .finally(() => {
      inflightStops.delete(key);
    });

  inflightStops.set(key, stopPromise);
  return stopPromise;
}

export async function postToOllamaChat(
  payload: unknown,
  signal?: AbortSignal,
  options?: { keepalive?: boolean }
): Promise<Response> {
  const { baseUrl, upstreamHeaders } = getOllamaConfig();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: upstreamHeaders,
    signal,
    keepalive: options?.keepalive,
    body: JSON.stringify(payload),
  });
  return res;
}

function getOllamaConfig() {
  const baseUrl = (process.env["BASE_URL"]?.trim() || "localhost:11434").replace(/\/$/, "");
  const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.NEXT_PUBLIC_OLLAMA_API_KEY?.trim();
  if (apiKey) upstreamHeaders["X-API-Key"] = apiKey;
  return { baseUrl, upstreamHeaders } as const;
}

import { spawnSync } from "node:child_process";

export type StopOutcome = "skipped" | "stopped" | "failed";

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

export function isModelPulled(model: string): boolean {
  const pulledModels = getPulledModels();
  return pulledModels.includes(model);
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

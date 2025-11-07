import { getMessage } from "@/app/helpers/functions";
import { type ActionKey } from "@/app/helpers/types";
import { NextResponse } from "next/server";
import { spawn, spawnSync } from "node:child_process";

async function pullModelWithAbort(model: string, signal: AbortSignal) {
  if (signal.aborted) {
    return { status: null as number | null, stderr: "", aborted: true };
  }

  return new Promise<{ status: number | null; stderr: string; aborted: boolean }>((resolve, reject) => {
    const child = spawn("node", ["--import", "tsx", "scripts/pull-ollama.mts", "--model", model], {
      stdio: ["ignore", "ignore", "pipe"],
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const abortHandler = () => {
      if (!child.killed) {
        child.kill();
      }
    };

    signal.addEventListener("abort", abortHandler);

    child.on("error", (err) => {
      signal.removeEventListener("abort", abortHandler);
      reject(err);
    });

    child.on("close", (code) => {
      signal.removeEventListener("abort", abortHandler);
      resolve({
        status: typeof code === "number" ? code : null,
        stderr,
        aborted: signal.aborted,
      });
    });
  });
}

export function getPulledModels(): string[] {
  const models: string[] = [];
  const list = spawnSync("ollama", ["list"], {
    encoding: "utf8",
    env: process.env,
  });
  const raw = !list.error && typeof list.stdout === "string" ? list.stdout : "";
  // parse list output by extracting model-name-like tokens from each line
  if (raw) {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      // skip header-like lines
      if (!line.trim() || (line.toLowerCase().includes("name") && line.toLowerCase().includes("id"))) continue;
      const match = line.match(/[A-Za-z0-9_\-:.]+/g);
      if (match?.length) {
        // assume first token is the model name
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

export async function GET() {
  try {
    return NextResponse.json(getPulledModels());
  } catch (err) {
    return NextResponse.json({ error: getMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // API key protection
    const apiKey = process.env.NEXT_PUBLIC_OLLAMA_API_KEY?.trim();
    if (apiKey) {
      const provided = request.headers.get("X-API-Key") ?? "";
      if (provided !== apiKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    const body = await request.json().catch(() => {
      console.warn("no body");
    });
    const action = body.action as ActionKey;
    const model = body.model as string;

    if (!["start", "stop"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (!model || typeof model !== "string") {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    if (action === "start") {
      if (isModelPulled(model)) {
        return NextResponse.json({ available: true, model });
      }

      const result = await pullModelWithAbort(model, request.signal);

      if (result.aborted) {
        return NextResponse.json({ available: false, model, aborted: true }, { status: 499 });
      }

      let message = result.stderr;
      try {
        message = JSON.parse(message).error;
      } catch {
        // ignore
      }
      if (message) console.error(message);
      const success = result.status === 0;
      return NextResponse.json({ available: success, model }, { status: success ? 200 : 500 });
    }

    // (action === "stop")
    try {
      if (!isModelPulled(model)) {
        return NextResponse.json({ stopped: "ignored, not found" });
      }
      const stop = spawnSync("ollama", ["stop", model], {
        stdio: "inherit",
        env: process.env,
      });
      if (stop.error || stop.status !== 0) {
        return NextResponse.json({ stopped: false });
      }
      return NextResponse.json({ stopped: true });
    } catch (err) {
      throw err;
    }
  } catch (err) {
    return NextResponse.json({ error: getMessage(err) }, { status: 500 });
  }
}

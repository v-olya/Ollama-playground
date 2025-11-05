import { ActionKey } from "@/app/helpers/types";
import { NextResponse } from "next/server";
import { spawn, spawnSync } from "node:child_process";

export async function GET(request: Request) {
  try {
    // API key protection (if configured)
    const apiKey = process.env.NEXT_PUBLIC_OLLAMA_API_KEY?.trim();
    if (apiKey) {
      const provided = request.headers.get("X-API-Key") ?? "";
      if (provided !== apiKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const url = new URL(request.url);
    const listAll = url.searchParams.get("list") === "all";

    if (listAll) {
      const result: Record<string, { raw?: string; models: string[] }> = {};
      for (const m of ["primary", "secondary"]) {
        const host = process.env["BASE_URL"];
        if (!host) {
          result[m] = { models: [] };
          continue;
        }
        try {
          // prefer `ollama list` which is more stable across cloud/local
          const ps = spawnSync("ollama", ["list"], {
            encoding: "utf8",
            env: { ...process.env, OLLAMA_HOST: host },
          });
          const raw =
            !ps.error && typeof ps.stdout === "string" ? ps.stdout : "";
          // parse list output by extracting model-name-like tokens from each line
          const models: string[] = [];
          if (raw) {
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              // skip header-like lines
              if (
                !line.trim() ||
                (line.toLowerCase().includes("name") &&
                  line.toLowerCase().includes("id"))
              )
                continue;
              const match = line.match(/[A-Za-z0-9_\-:.]+/g);
              if (match && match.length) {
                // assume first token is the model name
                models.push(match[0]);
              }
            }
          }
          result[m] = { raw, models };
        } catch {
          result[m] = { models: [] };
        }
      }
      return NextResponse.json({ info: result });
    }

    const host = process.env["BASE_URL"];
    if (!host) return NextResponse.json({ mode: null, models: [] });
    try {
      const ps = spawnSync("ollama", ["list"], {
        encoding: "utf8",
        env: { ...process.env, OLLAMA_HOST: host },
      });
      const raw = !ps.error && typeof ps.stdout === "string" ? ps.stdout : "";
      const models: string[] = [];
      if (raw) {
        const lines = raw.split(/\r?\n/);
        for (const line of lines) {
          if (
            !line.trim() ||
            (line.toLowerCase().includes("name") &&
              line.toLowerCase().includes("id"))
          )
            continue;
          const match = line.match(/[A-Za-z0-9_\-:.]+/g);
          if (match && match.length) models.push(match[0]);
        }
      }
      return NextResponse.json({ mode: null, host, models, raw });
    } catch {
      return NextResponse.json({ mode: null, models: [] });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // API key protection (if configured)
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
    const action = (body.action ?? "") as ActionKey | "";
    const model = body.model as string;

    if (!["start", "stop"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    if (action === "start") {
      // spawn the script detached so it lives beyond the request lifetime.
      const child = spawn(
        "node",
        ["--loader", "ts-node/esm", "scripts/run-ollama.mts", "--model", model],
        {
          detached: true,
          stdio: "ignore",
          env: process.env,
        }
      );
      child.unref();
      return NextResponse.json({ started: true, pid: child.pid, model });
    }

    // stop action: call ollama stop against the appropriate host
    const host = process.env["BASE_URL"];
    try {
      const stop = spawnSync("ollama", ["stop", model], {
        stdio: "inherit",
        env: { ...process.env, OLLAMA_HOST: host ?? process.env.OLLAMA_HOST },
      });
      if (stop.error || stop.status !== 0) {
        return NextResponse.json({ stopped: false }, { status: 500 });
      }
      return NextResponse.json({ stopped: true });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

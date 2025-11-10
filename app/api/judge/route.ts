import { NextResponse } from "next/server";
import { getMessage } from "@/app/helpers/functions";
import { ensureModelStopped } from "../ollama/utils";
import { spawn } from "node:child_process";

async function pullModelWithAbort(model: string, signal: AbortSignal): Promise<"ok" | "aborted" | "error"> {
  return new Promise((resolve) => {
    const child = spawn("node", ["--import", "tsx", "scripts/pull-ollama.mts", "--model", model], {
      stdio: "inherit",
      env: process.env,
    });

    const onAbort = () => {
      child.kill();
      resolve("aborted");
    };

    signal.addEventListener("abort", onAbort);

    child.on("exit", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve("ok");
      } else {
        resolve("error");
      }
    });

    child.on("error", () => {
      signal.removeEventListener("abort", onAbort);
      resolve("error");
    });
  });
}

type JudgeRequest = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
};

type StreamEvent = {
  type: "start" | "delta" | "complete" | "error";
  content?: string;
  error?: string;
};

export async function GET() {
  return NextResponse.json({});
}

export async function POST(request: Request) {
  let model = "";
  let aborted = false;

  const cleanup = async () => {
    if (model) {
      await ensureModelStopped(model).catch((err) => console.warn(`Error stopping model "${model}":`, err));
    }
  };

  const abortHandler = () => {
    aborted = true;
    cleanup().catch((err) => console.error("Cleanup error on abort:", err));
  };

  request.signal.addEventListener("abort", abortHandler);

  try {
    const body = await request.json().catch(() => ({}));
    const { model: reqModel, systemPrompt, userPrompt } = body as JudgeRequest;

    model = typeof reqModel === "string" ? reqModel.trim() : "";

    if (!model) {
      return NextResponse.json({ error: "Model is required." }, { status: 400 });
    }

    if (!systemPrompt || !userPrompt) {
      return NextResponse.json({ error: "System and user prompts are required." }, { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        try {
          sendEvent({ type: "start" });

          const pullResult = await pullModelWithAbort(model, request.signal);

          if (pullResult === "aborted") {
            await cleanup();
            controller.close();
            return;
          }

          if (pullResult === "error") {
            throw new Error(`Failed to pull model "${model}"`);
          }

          const messages = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: userPrompt },
          ];

          const response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: request.signal,
            body: JSON.stringify({
              model,
              messages,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(errText || `Upstream error ${response.status}`);
          }

          if (!response.body) {
            throw new Error("No response body from upstream");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            if (aborted || request.signal.aborted) {
              try {
                await reader.cancel();
              } catch {}
              await cleanup();
              controller.close();
              return;
            }

            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const json = JSON.parse(trimmed);

                if (json.error) {
                  throw new Error(json.error);
                }

                if (json.done) {
                  break;
                }

                const delta = json.message?.content || "";
                if (delta) {
                  sendEvent({ type: "delta", content: delta });
                }
              } catch {
                continue;
              }
            }
          }

          sendEvent({ type: "complete" });
          await cleanup();
          controller.close();
        } catch (err) {
          const isAbortError =
            (err instanceof DOMException && err.name === "AbortError") ||
            (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");

          if (!isAbortError) {
            sendEvent({ type: "error", error: getMessage(err) });
          }

          await cleanup();
          controller.close();
        }
      },

      async cancel() {
        aborted = true;
        await cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    await cleanup();
    request.signal.removeEventListener("abort", abortHandler);

    const isAbortError =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");

    if (isAbortError) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }

    return NextResponse.json({ error: getMessage(err) }, { status: 500 });
  }
}

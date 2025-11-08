import { NextResponse } from "next/server";
import { isModelPulled } from "../ollama/route";
import { getMessage } from "@/app/helpers/functions";

// Per-model replace-in-flight gate: latest wins
const activeByModel = new Map<
  string,
  {
    controller: AbortController;
  }
>();

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function GET() {
  return NextResponse.json({});
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      console.warn("No response body");
    });

    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!model) {
      return NextResponse.json({ error: "Model is required." }, { status: 400 });
    }
    if (!isModelPulled(model)) {
      return NextResponse.json({ error: "Model is not pulled yet." }, { status: 400 });
    }
    // Messages are provided by FE
    const rawMessages: IncomingMessage[] = Array.isArray(body.messages)
      ? body.messages
          .map((msg: IncomingMessage) => ({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content.trim() : "",
          }))
          .filter((msg: IncomingMessage) => msg.content.length > 0)
      : [];

    if (!rawMessages.length) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 });
    }
    // Direct Ollama REST streaming
    const baseUrl = (process.env["BASE_URL"]?.trim() || "localhost:11434").replace(/\/$/, "");
    const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };

    if (process.env.NEXT_PUBLIC_OLLAMA_API_KEY?.trim()) {
      upstreamHeaders["X-API-Key"] = process.env.NEXT_PUBLIC_OLLAMA_API_KEY.trim();
    }

    // Abort any existing run for this model key
    const key = `${baseUrl}|${model}`;
    const prev = activeByModel.get(key);
    try {
      prev?.controller.abort();
    } catch {}

    // Create a controller and tie it to request.abort
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort);
    activeByModel.set(key, { controller });

    // Overall timeout for upstream call
    const timeoutMs = Number(45000);
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    const upstream = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders,
      signal: (() => {
        // Merge request-driven and timeout-driven aborts
        const merged = new AbortController();
        const onAbort1 = () => merged.abort();
        const onAbort2 = () => merged.abort();
        controller.signal.addEventListener("abort", onAbort1);
        timeoutController.signal.addEventListener("abort", onAbort2);
        // Clean up listeners when merged aborts
        merged.signal.addEventListener("abort", () => {
          controller.signal.removeEventListener("abort", onAbort1);
          timeoutController.signal.removeEventListener("abort", onAbort2);
        });
        return merged.signal;
      })(),
      body: JSON.stringify({
        model,
        messages: rawMessages,
        stream: true,
      }),
    });

    clearTimeout(timeoutId);

    if (!upstream.body) {
      return NextResponse.json({ error: "No upstream stream" }, { status: 502 });
    }

    if (!upstream.ok) {
      const errTxt = await upstream.text().catch(() => "");
      return NextResponse.json({ error: errTxt || `Upstream error ${upstream.status}` }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();
    let buffer = "";

    const stream = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        if (controller.signal.aborted) {
          try {
            await reader.cancel();
          } catch {}
          streamController.close();
          return;
        }
        if (request.signal.aborted) {
          try {
            await reader.cancel();
          } catch {}
          streamController.close();
          return;
        }
        // Inactivity timeout per-chunk
        const chunkTimeoutMs = Number(20000);
        const chunkTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, chunkTimeoutMs);
        const { done, value } = await reader.read();
        if (chunkTimer) clearTimeout(chunkTimer);
        if (done) {
          streamController.close();
          return;
        }
        buffer += new TextDecoder().decode(value, { stream: true });
        // Ollama sends NDJSON; split on newlines
        const lines = buffer.split(/\r?\n/);
        // Keep last line in buffer
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          type OllamaStreamChunk = {
            message?: { content?: string };
            response?: string; // for /api/generate shape
            done?: boolean;
            error?: string;
          };
          let json: OllamaStreamChunk | undefined;
          try {
            json = JSON.parse(trimmed);
          } catch {
            continue; // skip malformed line
          }
          if (json?.error) {
            streamController.enqueue(encoder.encode(`\n[error] ${json.error}`));
            continue;
          }
          if (json?.done) {
            streamController.close();
            return;
          }
          // Prefer chat delta under message.content; fall back to generate delta
          const chatDelta = json?.message?.content;
          const genDelta = json?.response;
          const delta = typeof chatDelta === "string" ? chatDelta : typeof genDelta === "string" ? genDelta : "";
          if (delta) streamController.enqueue(encoder.encode(delta));
        }
      },
      async cancel() {
        try {
          await reader.cancel();
        } catch {}
        try {
          controller.abort();
        } catch {}
      },
    });

    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });

    // when response finishes or if the controller is superseded
    const cleanup = () => {
      request.signal.removeEventListener("abort", onAbort);
      const entry = activeByModel.get(key);
      if (entry?.controller === controller) {
        activeByModel.delete(key);
      }
    };
    Promise.resolve().finally(cleanup);
    return response;
  } catch (err) {
    // If the request was aborted, don't log it as an error
    const isAborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");

    if (!isAborted) {
      console.error("Error in /api/compare:", err);
    }

    if (isAborted) {
      // 499 (Client Closed Request)
      // client will receive it if only its connection is still open,
      // i.e.the request was aborted by the Server, not by the Client itself
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    return NextResponse.json({ error: getMessage(err) }, { status: 500 });
  }
}

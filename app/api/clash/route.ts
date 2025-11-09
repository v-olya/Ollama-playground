import { NextResponse } from "next/server";
import { getMessage } from "@/app/helpers/functions";
import { ensureModelStopped, isModelPulled } from "../ollama/utils";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ClashRequest = {
  modelA: string;
  modelB: string;
  systemPrompt: string;
  userPrompt: string;
  maxRounds: number;
  startFromTurn?: number;
};

type StreamEvent = {
  type: "turn-start" | "delta" | "turn-end" | "complete" | "error";
  speaker?: "A" | "B";
  content?: string;
  turn?: number;
  error?: string;
};

export async function GET() {
  return NextResponse.json({});
}

export async function POST(request: Request) {
  let modelA = "";
  let modelB = "";
  let aborted = false;
  let modelsToStop: Set<string> = new Set();

  const cleanup = async () => {
    const stopPromises: Promise<void>[] = [];

    for (const model of modelsToStop) {
      stopPromises.push(
        ensureModelStopped(model)
          .then((result) => {
            if (result === "failed") {
              console.warn(`Failed to stop model "${model}" during cleanup.`);
            }
          })
          .catch((err) => {
            console.warn(`Error stopping model "${model}":`, err);
          })
      );
    }

    await Promise.all(stopPromises);
    modelsToStop.clear();
  };

  const abortHandler = () => {
    aborted = true;
    cleanup().catch((err) => console.error("Cleanup error on abort:", err));
  };

  request.signal.addEventListener("abort", abortHandler);

  try {
    const body = await request.json().catch(() => ({}));

    const {
      modelA: reqModelA,
      modelB: reqModelB,
      systemPrompt,
      userPrompt,
      maxRounds,
      startFromTurn,
    } = body as ClashRequest;

    modelA = typeof reqModelA === "string" ? reqModelA.trim() : "";
    modelB = typeof reqModelB === "string" ? reqModelB.trim() : "";

    if (!modelA || !modelB) {
      return NextResponse.json({ error: "Both models are required." }, { status: 400 });
    }

    if (!systemPrompt || !userPrompt) {
      return NextResponse.json({ error: "System and user prompts are required." }, { status: 400 });
    }

    const rounds = typeof maxRounds === "number" && maxRounds > 0 ? maxRounds : 3;
    const startTurn = typeof startFromTurn === "number" && startFromTurn > 0 ? startFromTurn : 1;

    // Check if models are pulled
    if (!isModelPulled(modelA)) {
      return NextResponse.json({ error: `Model A (${modelA}) is not pulled.` }, { status: 400 });
    }

    if (!isModelPulled(modelB)) {
      return NextResponse.json({ error: `Model B (${modelB}) is not pulled.` }, { status: 400 });
    }

    modelsToStop.add(modelA);
    modelsToStop.add(modelB);

    const baseUrl = (process.env["BASE_URL"]?.trim() || "localhost:11434").replace(/\/$/, "");
    const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };

    if (process.env.NEXT_PUBLIC_OLLAMA_API_KEY?.trim()) {
      upstreamHeaders["X-API-Key"] = process.env.NEXT_PUBLIC_OLLAMA_API_KEY.trim();
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: StreamEvent) => {
          if (aborted) return;
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        const allResponses: string[] = [];

        try {
          for (let turn = startTurn; turn <= rounds * 2; turn++) {
            if (aborted || request.signal.aborted) {
              await cleanup();
              controller.close();
              return;
            }

            const currentModel = turn % 2 === 1 ? modelA : modelB;
            const speaker = turn % 2 === 1 ? "A" : "B";

            sendEvent({ type: "turn-start", speaker, turn });

            const messages: Message[] = [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ];

            for (let i = 0; i < allResponses.length; i++) {
              const isOwnResponse = turn % 2 === 1 ? i % 2 === 0 : i % 2 === 1;
              messages.push({
                role: isOwnResponse ? "assistant" : "user",
                content: allResponses[i],
              });
            }

            const response = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: upstreamHeaders,
              signal: request.signal,
              body: JSON.stringify({
                model: currentModel,
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
            let fullContent = "";
            let streamDone = false;

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
                    streamDone = true;
                    break;
                  }

                  const delta = json.message?.content || "";
                  if (delta) {
                    fullContent += delta;
                    sendEvent({ type: "delta", content: delta, speaker, turn });
                  }
                } catch (parseErr) {
                  continue;
                }
              }

              if (streamDone) break;
            }

            if (fullContent.trim()) {
              allResponses.push(fullContent);
            }

            sendEvent({ type: "turn-end", speaker, turn });
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

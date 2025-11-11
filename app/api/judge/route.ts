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

type ScoreKey = "relevance" | "clarity" | "depth" | "engagement" | "creativity";

type ScoreBreakdown = Record<ScoreKey, number>;

type WinnerLabel = "Model A" | "Model B" | "Tie";

type JudgeResult = {
  modelA: ScoreBreakdown;
  modelB: ScoreBreakdown;
  winner: WinnerLabel;
  text_feedback: string;
  thinking_steps?: string;
};

const scoreKeys: ScoreKey[] = ["relevance", "clarity", "depth", "engagement", "creativity"];

function normalizeScore(value: unknown, key: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1 || value > 10) {
      throw new Error(`${key} must be between 1 and 10`);
    }
    return value;
  }

  if (typeof value === "string") {
    const str = value.trim();
    const numeric = Number.parseFloat(str);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      if (numeric < 1 || numeric > 10) {
        throw new Error(`${key} must be between 1 and 10`);
      }
      return numeric;
    }
  }

  throw new Error(`Invalid score for ${key}`);
}

function validateScoreBreakdown(value: unknown, label: "Model A" | "Model B"): ScoreBreakdown {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} scores must be an object`);
  }

  const candidate = value as Record<string, unknown>;
  const breakdown = {} as ScoreBreakdown;

  for (const key of scoreKeys) {
    const score = normalizeScore(candidate[key], `${label}.${key}`);
    if (score < 1 || score > 10) {
      throw new Error(`${label}.${key} must be between 1 and 10`);
    }
    breakdown[key] = score;
  }

  return breakdown;
}

function normalizeWinner(value: unknown): WinnerLabel {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("winner must be a non-empty string");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "model a" || normalized === "model_a" || normalized === "a") {
    return "Model A";
  }
  if (normalized === "model b" || normalized === "model_b" || normalized === "b") {
    return "Model B";
  }
  if (normalized === "tie" || normalized === "draw") {
    return "Tie";
  }

  throw new Error('winner must be "Model A", "Model B", or "Tie"');
}

function validateJudgeResult(payload: unknown): JudgeResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Model response is not an object");
  }

  const candidate = payload as Record<string, unknown>;

  let modelAData = candidate.modelA;
  let modelBData = candidate.modelB;

  // Models ignore format: json and format: schema instructions, so should handle variations.

  if (!modelAData && candidate.scores && typeof candidate.scores === "object") {
    const scores = candidate.scores as Record<string, unknown>;
    modelAData = scores.model_a || scores.modelA;
    modelBData = scores.model_b || scores.modelB;
  }
  if (!modelAData) {
    modelAData = candidate.model_a;
  }
  if (!modelBData) {
    modelBData = candidate.model_b;
  }

  const modelA = validateScoreBreakdown(modelAData, "Model A");
  const modelB = validateScoreBreakdown(modelBData, "Model B");
  const winner = normalizeWinner(candidate.winner);

  const feedback = candidate.text_feedback;
  if (typeof feedback !== "string" || !feedback.trim()) {
    throw new Error("text_feedback must be a non-empty string");
  }

  // Thinking steps: accept string or array of strings, normalize to a string.
  let thinkingSteps: string | undefined;
  if ("thinking_steps" in candidate) {
    const raw = candidate.thinking_steps;
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s) thinkingSteps = s;
    } else if (Array.isArray(raw)) {
      const parts = raw
        .filter((p) => typeof p === "string")
        .map((p) => (p as string).trim())
        .filter(Boolean);
      if (parts.length) thinkingSteps = parts.join("\n\n");
      else {
        thinkingSteps = undefined;
      }
    } else if (raw !== undefined && raw !== null) {
      throw new Error("thinking_steps must be a string or array of strings");
    }
  }

  return {
    modelA,
    modelB,
    winner,
    text_feedback: feedback.trim(),
    ...(thinkingSteps ? { thinking_steps: thinkingSteps } : {}),
  };
}

export async function GET() {
  return NextResponse.json({});
}

export async function POST(request: Request) {
  let model = "";
  let cleanupTriggered = false;

  const cleanup = async () => {
    if (cleanupTriggered || !model) {
      return;
    }
    cleanupTriggered = true;
    await ensureModelStopped(model).catch((err) => console.warn(`Error stopping model "${model}":`, err));
  };

  const abortHandler = () => {
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

    const pullResult = await pullModelWithAbort(model, request.signal);

    if (pullResult === "aborted") {
      await cleanup();
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }

    if (pullResult === "error") {
      throw new Error(`Failed to pull model "${model}"`);
    }

    const messages = [
      {
        role: "system" as const,
        content:
          systemPrompt +
          `

You MUST respond with a valid JSON object matching this EXACT structure:
{
  "modelA": {
    "relevance": <number 1-10>,
    "clarity": <number 1-10>,
    "depth": <number 1-10>,
    "engagement": <number 1-10>,
    "creativity": <number 1-10>
  },
  "modelB": {
    "relevance": <number 1-10>,
    "clarity": <number 1-10>,
    "depth": <number 1-10>,
    "engagement": <number 1-10>,
    "creativity": <number 1-10>
  },
  "winner": "<Model A|Model B|Tie>",
  "text_feedback": "<your feedback text>",
  "thinking_steps": ["<optional step 1>", "<optional step 2>"]
}

CRITICAL: Use these EXACT key names: "modelA", "modelB" (camelCase), do NOT any other variation. Return JSON object, NO markdown, NO extra text.`,
      },
      { role: "user" as const, content: userPrompt },
    ];
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(errText || `Upstream error ${response.status}`);
    }

    const isDev = process.env.NODE_ENV === "development";

    // Parse the upstream response
    const upstreamJson = await response.json().catch(() => null);

    if (!upstreamJson || typeof upstreamJson !== "object") {
      return NextResponse.json({ error: "Invalid upstream response", snippet: "No JSON response" }, { status: 502 });
    }

    // Extract message content from Ollama response
    const message = (upstreamJson as Record<string, unknown>).message;
    if (!message || typeof message !== "object") {
      return NextResponse.json(
        { error: "Missing message in response", snippet: JSON.stringify(upstreamJson).slice(0, 2000) },
        { status: 502 }
      );
    }

    const content = (message as Record<string, unknown>).content;
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid message content", snippet: JSON.stringify(message).slice(0, 2000) },
        { status: 502 }
      );
    }

    if (isDev) {
      console.debug("[judge] message.content:", content.slice(0, 4000));
    }

    // Parse the JSON content returned by the model
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      // Model didn't return valid JSON - send the raw content to FE
      await cleanup();
      const parseError = e instanceof Error ? e.message : "JSON parse error";
      return NextResponse.json({ error: parseError, snippet: content.slice(0, 2000) }, { status: 502 });
    }

    // Validate the parsed JSON against our schema
    let result: JudgeResult;
    try {
      result = validateJudgeResult(parsed);
    } catch (e) {
      // Validation failed - send the malformed JSON to FE
      await cleanup();
      const msg = e instanceof Error ? e.message : "Validation error";
      return NextResponse.json({ error: msg, snippet: content.slice(0, 2000) }, { status: 502 });
    }

    await cleanup();
    return NextResponse.json({ result });
  } catch (err) {
    await cleanup();

    const isAbortError =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError");

    if (isAbortError) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }

    return NextResponse.json({ error: getMessage(err) }, { status: 500 });
  } finally {
    request.signal.removeEventListener("abort", abortHandler);
  }
}

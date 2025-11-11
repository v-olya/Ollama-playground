"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { SelectWithDisabled } from "../components/SelectWithDisabled";
import { PromptTextarea } from "../components/PromptTextarea";
import { ConversationLayout } from "../components/ConversationLayout";
import { SendButton } from "../components/SendButton";
import { THINKING_MODELS } from "../contexts/ModelSelectionContext";
import { type Message } from "../helpers/types";
import { sendOllamaAction, isAbortError } from "../helpers/functions";
import {
  sectionHeading,
  card,
  errorAlert,
  pageContainer,
  headerRow,
  colStack,
  gridTwoCol,
  mutedSm,
  mutedXs,
  tableCell,
  tableHeader,
  secondaryButtonClass,
} from "../helpers/twClasses";

const defaultSystem = `You are an impartial AI judge tasked with evaluating a dialogue between two AI models. You must remain neutral and analytical. Score each model on the following criteria (1-10 scale):

• Relevance – Does it stay on topic and respond meaningfully to the other model?
• Clarity – Is the response easy to understand and well-structured?
• Depth – Does it show nuanced reasoning or explore implications?
• Engagement – Does it invite further dialogue or challenge ideas constructively?
• Creativity – Does it offer original ideas, metaphors, or surprising insights?

Determine the winner based on total scores. If scores differ by less than 5%, it's a tie; otherwise, you must declare a winner. Provide constructive feedback on strengths and weaknesses. Respond with JSON in the provided structure. Choose a faintly playful tone for your text_feedback.`;

type ScoreKey = "relevance" | "clarity" | "depth" | "engagement" | "creativity";

type ScoreBreakdown = Record<ScoreKey, number>;

type WinnerLabel = "Model A" | "Model B" | "Tie";

type JudgeResult = {
  modelA: ScoreBreakdown;
  modelB: ScoreBreakdown;
  winner: WinnerLabel;
  text_feedback: string;
  thinking_steps?: string | string[];
};

const scoreFieldMeta: Array<{ key: ScoreKey; label: string }> = [
  { key: "relevance", label: "Relevance" },
  { key: "clarity", label: "Clarity" },
  { key: "depth", label: "Depth" },
  { key: "engagement", label: "Engagement" },
  { key: "creativity", label: "Creativity" },
];

class JudgeRequestError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "JudgeRequestError";
    this.details = details;
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const parseBreakdown = (value: unknown, label: string): ScoreBreakdown => {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} scores must be an object`);
  }
  const record = value as Record<string, unknown>;
  const breakdown = {} as ScoreBreakdown;
  for (const { key } of scoreFieldMeta) {
    const rawScore = record[key];
    // Accept numbers or numeric strings representing 1..10 scale
    let score: number;
    if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
      score = rawScore;
    } else if (typeof rawScore === "string") {
      const parsed = Number.parseFloat(rawScore);
      if (Number.isFinite(parsed)) {
        score = parsed;
      } else {
        throw new Error(`${label}.${key} score is invalid`);
      }
    } else {
      throw new Error(`${label}.${key} score is invalid`);
    }

    if (!Number.isFinite(score)) {
      throw new Error(`${label}.${key} score is invalid`);
    }
    if (score < 1 || score > 10) {
      throw new Error(`${label}.${key} score must be between 1 and 10`);
    }
    breakdown[key] = score;
  }
  return breakdown;
};

const normalizeWinner = (value: unknown): WinnerLabel => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("winner must be Model A, Model B, or Tie");
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
  throw new Error("winner must be Model A, Model B, or Tie");
};

const parseThinkingSteps = (raw: unknown): string | undefined => {
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw)) return raw.filter(Boolean).join("\n\n") || undefined;
  return undefined;
};

// Helper to abort an AbortController safely (no-op on errors)
const safeAbortController = (ctrl: AbortController | null | undefined) => {
  if (!ctrl) return;
  try {
    ctrl.abort();
  } catch {
    // ignore abort errors
  }
};

export default function JudgePage() {
  const isDev = process.env.NODE_ENV === "development";
  const defaultJudgeModel = THINKING_MODELS[0].value;
  const [selectedJudgeModel, setSelectedJudgeModel] = useState(defaultJudgeModel);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystem);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [modelA, setModelA] = useState<string>("");
  const [modelB, setModelB] = useState<string>("");
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Generate user prompt from conversation history
  const generateUserPrompt = (conv: Message[]): string => {
    if (conv.length === 0) return "";

    return (
      "Please evaluate the following conversation between two AI models:\n\n" +
      conv
        .map((msg, idx) => {
          if (msg.role === "system") return null;
          const speaker = msg.role === "assistant" ? (idx % 2 === 0 ? "Model A" : "Model B") : "User";
          return `${speaker}: ${msg.content}`;
        })
        .filter(Boolean)
        .join("\n\n")
    );
  };

  const userPrompt = generateUserPrompt(conversation);

  useEffect(() => {
    const storedConversation = sessionStorage.getItem("lastConversation");
    if (!storedConversation) return;
    try {
      const parsed = JSON.parse(storedConversation);
      if (Array.isArray(parsed)) {
        setConversation(parsed);
      } else {
        setConversation(parsed.conversation || []);
        setModelA(parsed.modelA || "");
        setModelB(parsed.modelB || "");
      }
    } catch (e) {
      console.error("Failed to parse stored conversation:", e);
      setError("Failed to load conversation history");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        try {
          controllerRef.current.abort();
        } catch {}
        controllerRef.current = null;
      }

      try {
        void sendOllamaAction("stop", selectedJudgeModel, { keepalive: true });
      } catch {}
    };
  }, [selectedJudgeModel]);

  const handleScoreDebate = async () => {
    if (!conversation.length || isScoring) return;

    setIsScoring(true);
    setError(null);
    setErrorDetails(null);
    setStatusMessage("Loading the model…");
    setJudgeResult(null);

    try {
      safeAbortController(controllerRef.current);
      const controller = new AbortController();
      controllerRef.current = controller;

      const startResult = await sendOllamaAction("start", selectedJudgeModel, { signal: controller.signal });
      if (startResult.aborted) {
        setError(null);
        setErrorDetails(null);
        setStatusMessage(null);
        return;
      }

      const startResponse = startResult.response;
      if (!startResponse) {
        throw new Error("Failed to prepare model");
      }

      const startRaw = await startResponse.text();

      let startPayload: unknown = null;
      if (startRaw) {
        try {
          startPayload = JSON.parse(startRaw);
        } catch {
          // ignore
        }
      }

      const startRecord = isRecord(startPayload) ? startPayload : null;

      if (!startResponse.ok) {
        const message =
          startRecord && typeof startRecord.error === "string"
            ? startRecord.error || "Failed to prepare model"
            : startRaw || "Failed to prepare model";
        throw new Error(message);
      }

      if (startRecord && typeof startRecord.available === "boolean" && !startRecord.available) {
        const message =
          typeof startRecord.message === "string" ? startRecord.message : "Model could not be prepared for judging";
        throw new Error(message);
      }

      setStatusMessage("Scoring the debate…");

      const response = await fetch("/api/judge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedJudgeModel,
          systemPrompt,
          userPrompt,
        }),
      });

      const raw = await response.text();

      let payload: unknown = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          if (response.ok) {
            throw new Error("Judge response is not valid JSON");
          }
        }
      }

      const payloadRecord = isRecord(payload) ? payload : null;

      if (!response.ok) {
        const message =
          payloadRecord && typeof payloadRecord.error === "string"
            ? payloadRecord.error || "Failed to score debate"
            : raw || "Failed to score debate";
        const details = payloadRecord && typeof payloadRecord.snippet === "string" ? payloadRecord.snippet : null;
        throw new JudgeRequestError(message, details || undefined);
      }

      if (!payloadRecord || !("result" in payloadRecord)) {
        throw new Error("Judge response is missing result data");
      }

      const resultCandidate = payloadRecord.result;
      const resultRecord = isRecord(resultCandidate) ? resultCandidate : null;

      if (!resultRecord) {
        throw new Error("Judge result is malformed");
      }

      const candidate = resultRecord as Partial<JudgeResult>;

      const topLevelKeys: Array<keyof JudgeResult> = ["modelA", "modelB", "winner", "text_feedback"];
      for (const key of topLevelKeys) {
        if (!(key in candidate)) {
          throw new Error(`Judge result is missing ${key}`);
        }
      }

      const textFeedback = String(candidate.text_feedback ?? "").trim();
      if (!textFeedback) {
        throw new Error("Judge feedback is empty");
      }

      // Thinking steps returned by the judge model (developer/debugging only)
      const thinkingSteps = parseThinkingSteps((candidate as Record<string, unknown>).thinking_steps);

      const result: JudgeResult = {
        modelA: parseBreakdown(candidate.modelA, "Model A"),
        modelB: parseBreakdown(candidate.modelB, "Model B"),
        winner: normalizeWinner(candidate.winner),
        text_feedback: textFeedback,
        ...(thinkingSteps ? { thinking_steps: thinkingSteps } : {}),
      };

      setJudgeResult(result);
      setError(null);
      setErrorDetails(null);
      setStatusMessage(null);
    } catch (e) {
      if (isAbortError(e)) {
        setError(null);
        setErrorDetails(null);
        setStatusMessage(null);
        return;
      }
      setJudgeResult(null);
      if (e instanceof JudgeRequestError && e.details) {
        setErrorDetails(e.details);
      } else {
        setErrorDetails(null);
      }
      setError(e instanceof Error ? e.message : "An error occurred");
      setStatusMessage(null);
    } finally {
      setIsScoring(false);
      if (controllerRef.current) {
        controllerRef.current = null;
      }
    }
  };

  const stopScoring = async () => {
    safeAbortController(controllerRef.current);
    if (controllerRef.current) {
      controllerRef.current = null;
    }
    setIsScoring(false);
    setStatusMessage(null);

    try {
      await sendOllamaAction("stop", selectedJudgeModel, { keepalive: true });
    } catch {
      // ignore
    }
  };

  return (
    <div className={pageContainer}>
      <div className={headerRow}>
        <Image src="/judge.svg" alt="Judge" width={64} height={64} />
        <div className={`${colStack} gap-2`}>
          <label htmlFor="judge-model" className="my-1 px-3 text-sm font-medium text-zinc-700">
            Select a thinking model &nbsp;&nbsp;
            <div className="inline-flex items-center gap-2">
              <SendButton onClick={handleScoreDebate} disabled={isScoring || !conversation.length}>
                Score
              </SendButton>
              <button
                type="button"
                onClick={stopScoring}
                disabled={!isScoring}
                className={`${secondaryButtonClass} ${
                  isScoring ? "bg-red-600 text-white hover:bg-red-700" : "opacity-60"
                }`}
              >
                Stop
              </button>
            </div>
          </label>
          <SelectWithDisabled
            id="judge-model"
            value={selectedJudgeModel}
            onChange={setSelectedJudgeModel}
            disabled={isScoring}
            options={THINKING_MODELS}
          />{" "}
        </div>
      </div>
      <div className={gridTwoCol}>
        <div className={colStack}>
          <h2 className={sectionHeading}>
            {modelA && modelB ? (
              <>
                {modelA} <span className="text-red-700">&nbsp;VS&nbsp;</span> {modelB}
              </>
            ) : (
              "Last Conversation"
            )}
          </h2>
          <div className={`${card} flex-1 overflow-auto`}>
            {conversation.length ? (
              <ConversationLayout conversation={conversation} useModelLabels={true} labelA="Model A" labelB="Model B" />
            ) : (
              <p className={mutedSm}>
                No conversation history available. Please start a debate from the{" "}
                <a href="/clash" className="text-blue-600">
                  /clash
                </a>{" "}
                page first.
              </p>
            )}
          </div>
        </div>

        <div className={colStack}>
          <h2 className={sectionHeading}>Judge Configuration</h2>
          <div className="[&>label>:first-child]:hidden">
            <PromptTextarea
              label="System Prompt"
              value={systemPrompt}
              onChange={setSystemPrompt}
              disabled={isScoring}
              confirmOnBlur={false}
            />
          </div>

          {(isScoring || judgeResult) && (
            <div className={`mt-2 ${card}`}>
              {statusMessage && (
                <div className={`${card} text-center`}>
                  <p className="text-sky-700">{statusMessage}</p>
                </div>
              )}
              {error && <div className={errorAlert}>{error}</div>}
              {errorDetails && (
                <details className={`${card} ${mutedXs}`}>
                  <summary className={`cursor-pointer select-none ${mutedXs}`}>Error details</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-zinc-100 p-2 text-[11px] leading-4 text-zinc-800">
                    {errorDetails}
                  </pre>
                </details>
              )}
              {judgeResult && (
                <>
                  <h2 className={sectionHeading}>Judge&apos;s Verdict</h2>
                  <div className="rounded-md bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
                    <span className="font-semibold">{judgeResult.winner}</span>
                  </div>
                  <div className="mt-3 overflow-auto flex justify-center">
                    {(() => {
                      const totalA = scoreFieldMeta.reduce((s, { key }) => s + (judgeResult.modelA[key] ?? 0), 0);
                      const totalB = scoreFieldMeta.reduce((s, { key }) => s + (judgeResult.modelB[key] ?? 0), 0);
                      const diff = totalA - totalB;
                      const leader = diff === 0 ? "Tie" : diff > 0 ? "A" : "B";
                      // derive first and second for Diff column
                      const first = leader !== "Tie" ? leader : "A";
                      const second = leader === "B" ? "A" : "B";
                      return (
                        <div className={`mt-4 mx-auto w-full md:max-w-[400px] ${card}`}>
                          <div className="overflow-auto">
                            <table className="w-full text-sm table-fixed border-collapse">
                              <thead>
                                <tr>
                                  <th className={tableHeader}>Criterium</th>
                                  <th className={tableHeader}>Model A</th>
                                  <th className={tableHeader}>Model B</th>
                                  <th className={tableHeader}>
                                    {first} &ndash; {second}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {scoreFieldMeta.map(({ key, label }) => {
                                  const winnerScore = judgeResult[`model${first}`][key];
                                  const loserScore = judgeResult[`model${second}`][key];
                                  const colorClass =
                                    winnerScore > loserScore
                                      ? "text-emerald-700"
                                      : winnerScore < loserScore
                                      ? "text-red-600"
                                      : "text-zinc-700";
                                  const diffText = `${(winnerScore - loserScore).toFixed(1)}`;
                                  return (
                                    <tr key={key} className="odd:bg-white even:bg-zinc-50">
                                      <td className={tableCell}>{label}</td>
                                      <td className={tableCell}>{judgeResult.modelA[key].toFixed(1)}</td>
                                      <td className={tableCell}>{judgeResult.modelB[key].toFixed(1)}</td>
                                      <td className={`px-3 py-2 text-center font-medium ${colorClass}`}>{diffText}</td>
                                    </tr>
                                  );
                                })}

                                <tr className="border-t">
                                  <td />
                                  <td className={tableCell}>{totalA.toFixed(1)}</td>
                                  <td className={tableCell}>{totalB.toFixed(1)}</td>
                                  <td />
                                </tr>

                                <tr>
                                  <td />
                                  <td colSpan={3} className="px-3 py-2 text-xs text-zinc-600">
                                    {diff === 0
                                      ? "The models were evaluated equally"
                                      : `${diff > 0 ? "Model A" : "Model B"} leads by ${Math.abs(diff).toFixed(
                                          1
                                        )} points (${(
                                          (Math.abs(diff) / Math.max(1, (totalA + totalB) / 2)) *
                                          100
                                        ).toFixed(1)}%)`}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Feedback</div>
                    <p className="whitespace-pre-wrap text-sm text-zinc-800">{judgeResult.text_feedback}</p>
                  </div>
                  {isDev && judgeResult.thinking_steps && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Chain of thoughts
                      </div>
                      {/* Render thinking steps. If the judge returned an array, show each array item as a step. If a string was returned, split by newlines. */}
                      {(() => {
                        const raw = judgeResult.thinking_steps;
                        let steps: string[] = [];
                        if (Array.isArray(raw)) {
                          steps = raw as string[];
                        } else if (typeof raw === "string") {
                          const parts = raw
                            .split(/\n\n+/)
                            .map((p: string) => p.trim())
                            .filter(Boolean);
                          steps = parts.length
                            ? parts
                            : raw
                                .split(/\n+/)
                                .map((l: string) => l.trim())
                                .filter(Boolean);
                        }
                        return (
                          <ol className="ml-4 list-decimal space-y-1 text-sm text-zinc-800">
                            {steps.map((step: string, i: number) => (
                              <li key={i} className="whitespace-pre-wrap">
                                {step}
                              </li>
                            ))}
                          </ol>
                        );
                      })()}
                    </div>
                  )}
                  <details className="mt-4 text-xs text-zinc-500">
                    <summary className="cursor-pointer select-none text-xs font-medium text-zinc-600">Raw JSON</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-zinc-100 p-2 text-[11px] leading-4 text-zinc-800">
                      {JSON.stringify(judgeResult, null, 2)}
                    </pre>
                  </details>{" "}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

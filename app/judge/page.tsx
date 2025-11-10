"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { SelectWithDisabled } from "../components/SelectWithDisabled";
import { PromptTextarea } from "../components/PromptTextarea";
import { ConversationLayout } from "../components/ConversationLayout";
import { SendButton } from "../components/SendButton";
import { MODEL_OPTIONS } from "../contexts/ModelSelectionContext";
import { type Message } from "../helpers/types";
import { nextId } from "../helpers/functions";

const defaultSystem = `You are an impartial AI judge tasked with evaluating a dialogue between two AI models. Your role is to assess the quality, coherence, originality, and relevance of each model's responses. You must remain neutral and analytical. Provide constructive feedback, highlight strengths and weaknesses, and declare a winner based on clear criteria.

The criteria are:
• Relevance – Does it stay on topic and respond meaningfully to the other model?
• Clarity – Is the response easy to understand and well-structured?
• Depth – Does it show nuanced reasoning or explore implications?
• Engagement – Does it invite further dialogue or challenge ideas constructively?
• Creativity – Does it offer original ideas, metaphors, or surprising insights?

Response with JSON: {relevance: number(%), clarity: number(%), depth: number(%), engagement: number(%), creativity: number(%), text_feedback: string}. For the text part of response, choose playful commentary tone.`;

const sectionHeadingClass = "text-lg font-semibold mb-3 text-zinc-800";
const cardClass = "rounded-md border border-zinc-200 bg-white p-4 shadow-sm";
const errorClass = "mb-6 rounded-md bg-red-100 px-4 py-3 text-sm text-red-800";

type StreamEvent = {
  type: "start" | "delta" | "complete" | "error";
  content?: string;
  error?: string;
};

export default function JudgePage() {
  const [selectedJudgeModel, setSelectedJudgeModel] = useState(MODEL_OPTIONS[0].value);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystem);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [judgeOutput, setJudgeOutput] = useState<Message[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

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
    const storedConversation = sessionStorage.getItem("judgeConversation");
    if (!storedConversation) return;
    try {
      const parsed = JSON.parse(storedConversation);
      setConversation(parsed);
      sessionStorage.removeItem("judgeConversation");
    } catch (e) {
      console.error("Failed to parse stored conversation:", e);
      setError("Failed to load conversation history");
    }
  }, []);

  const handleScoreDebate = async () => {
    setIsScoring(true);
    setError(null);
    setJudgeOutput([]);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedJudgeModel,
          systemPrompt,
          userPrompt,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? "Failed to start judging");
      }

      if (!response.body) {
        throw new Error("No response stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed) as StreamEvent;

            switch (event.type) {
              case "start":
                setIsPulling(true);
                break;

              case "delta":
                setIsPulling(false);
                if (event.content) {
                  if (!currentMessageIdRef.current) {
                    const msgId = nextId("assistant");
                    currentMessageIdRef.current = msgId;
                    setJudgeOutput([{ id: msgId, role: "assistant", content: event.content }]);
                  } else {
                    const msgId = currentMessageIdRef.current;
                    setJudgeOutput((prev) =>
                      prev.map((msg) => (msg.id === msgId ? { ...msg, content: msg.content + event.content } : msg))
                    );
                  }
                }
                break;

              case "complete":
                setIsPulling(false);
                currentMessageIdRef.current = null;
                break;

              case "error":
                setIsPulling(false);
                if (event.error) {
                  setError(event.error);
                }
                break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (e) {
      const isAbortError = e instanceof DOMException && e.name === "AbortError";

      if (!isAbortError) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    } finally {
      setIsScoring(false);
      controllerRef.current = null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-center gap-4 mb-8">
        <Image src="/judge.svg" alt="Judge" width={64} height={64} />
        <div className="flex flex-col gap-2">
          <label htmlFor="judge-model" className="text-sm font-medium text-zinc-700">
            Select Judge Model
          </label>
          <SelectWithDisabled
            id="judge-model"
            value={selectedJudgeModel}
            onChange={setSelectedJudgeModel}
            disabled={isScoring}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col">
          <h2 className={sectionHeadingClass}>Conversation History</h2>
          <div className={`${cardClass} flex-1 overflow-auto max-h-[600px]`}>
            {conversation.length ? (
              <ConversationLayout conversation={conversation} useModelLabels={true} labelA="Model A" labelB="Model B" />
            ) : (
              <p className="text-sm text-zinc-500">
                No conversation history available. Please start a debate from the{" "}
                <a href="/clash" className="text-blue-600">
                  /clash page
                </a>{" "}
                first.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className={sectionHeadingClass}>Judge Configuration</h2>
          <div className="[&>label>:first-child]:hidden">
            <PromptTextarea
              label="System Prompt"
              value={systemPrompt}
              onChange={setSystemPrompt}
              disabled={isScoring}
              confirmOnBlur={false}
            />
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <SendButton onClick={handleScoreDebate} disabled={isScoring || !conversation.length}>
          {isPulling ? "Pulling model..." : isScoring ? "Scoring..." : "Score the debate"}
        </SendButton>
      </div>

      {error && <div className={errorClass}>{error}</div>}

      {judgeOutput.length > 0 && (
        <div className={cardClass}>
          <h2 className={sectionHeadingClass}>Judge&apos;s Verdict</h2>
          <ConversationLayout conversation={judgeOutput} useModelLabels={false} />
        </div>
      )}
    </div>
  );
}

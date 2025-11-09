"use client";

import { useState, useRef, useEffect } from "react";
import { ConversationDisplay } from "./ConversationDisplay";
import { type Message } from "../helpers/types";
import { getMessage, nextId } from "../helpers/functions";
import { maxTurns } from "../clash/page";

interface AIDialogueProps {
  systemPrompt: string;
  userPrompt: string;
  modelA: string;
  modelB: string;
  isActive: boolean;
}

export function AIDialogue({ systemPrompt, userPrompt, modelA, modelB, isActive }: AIDialogueProps) {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<"A" | "B" | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const turnCountRef = useRef(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isActive && !hasStartedRef.current && userPrompt.trim()) {
      hasStartedRef.current = true;
      startDialogue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const startDialogue = async () => {
    setConversation([]);
    setError(null);
    turnCountRef.current = 0;
    setIsThinking(false);
    setCurrentSpeaker(null);
    setIsLoading(true);

    // First, ensure both models are pulled
    try {
      // Check and pull Model A if needed
      const resA = await fetch("/api/ollama", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "",
        },
        body: JSON.stringify({ action: "start", model: modelA }),
      });

      if (!resA.ok) {
        const dataA = await resA.json();
        throw new Error(`Model A (${modelA}): ${dataA?.error ?? "Failed to start"}`);
      }

      // Check and pull Model B if needed
      const resB = await fetch("/api/ollama", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "",
        },
        body: JSON.stringify({ action: "start", model: modelB }),
      });

      if (!resB.ok) {
        const dataB = await resB.json();
        throw new Error(`Model B (${modelB}): ${dataB?.error ?? "Failed to start"}`);
      }
    } catch (err) {
      setError(getMessage(err));
      setIsThinking(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    // Add initial user message
    const userMessage: Message = {
      id: nextId("user"),
      role: "user",
      content: userPrompt.trim(),
    };

    setConversation([userMessage]);

    // Model A responds first
    await getModelResponse(modelA, "A", [userMessage]);
  };

  const getModelResponse = async (model: string, speaker: "A" | "B", conversationHistory: Message[]) => {
    if (turnCountRef.current >= maxTurns) {
      setIsThinking(false);
      setCurrentSpeaker(null);
      return;
    }

    turnCountRef.current++;
    setCurrentSpeaker(speaker);
    setIsThinking(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    const payloadMessages = [{ role: "system", content: systemPrompt }, ...conversationHistory];

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: payloadMessages,
        }),
      });

      if (controller.signal.aborted) {
        return;
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (res.ok && contentType.includes("text/plain")) {
        const assistantMessage: Message = {
          id: nextId("assistant"),
          role: "assistant",
          content: "",
        };

        setConversation((prev) => [...prev, assistantMessage]);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (controller.signal.aborted) {
              try {
                await reader.cancel();
              } catch {}
              break;
            }
            acc += decoder.decode(value, { stream: true });
            const latest = acc;
            setConversation((prev) => prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: latest } : m)));
          }
        }

        // After Model A responds, Model B should respond (using Model A's response as input)
        const nextSpeaker = speaker === "A" ? "B" : "A";
        const nextModel = speaker === "A" ? modelB : modelA;
        const updatedHistory = [...conversationHistory, { ...assistantMessage, content: acc }];

        setIsThinking(false);
        setCurrentSpeaker(null);

        // Continue the dialogue with the other model
        setTimeout(() => {
          getModelResponse(nextModel, nextSpeaker, updatedHistory);
        }, 500);
      } else {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to fetch model response.");
      }
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError") ||
        controller.signal.aborted;
      if (isAbort) {
        return;
      }
      setError(getMessage(err));
      setIsThinking(false);
      setCurrentSpeaker(null);
    }
  };

  return (
    <section className="flex h-[500px] w-full flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#0b0b0b]">
      <header className="flex flex-col gap-2 text-center">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            AI-to-AI Dialogue
          </h3>
          <button
            onClick={() => {
              hasStartedRef.current = false;
              startDialogue();
            }}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isThinking || isLoading}
          >
            Restart
          </button>
        </div>
        <span className="text-sm text-sky-700 dark:text-sky-400">
          {isLoading ? "Loading…" : isThinking && currentSpeaker ? `Responding…` : null}
        </span>
        {error && <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
      </header>

      <ConversationDisplay
        conversation={conversation}
        emptyMessage="Click 'Restart' to begin dialogue"
        useModelLabels={true}
        labelA={`Model A`}
        labelB={`Model B`}
      />
    </section>
  );
}

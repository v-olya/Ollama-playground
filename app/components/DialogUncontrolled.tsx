"use client";

import { useState, useRef, useEffect } from "react";
import { ConversationLayout } from "./ConversationLayout";
import { secondaryButtonClass } from "./buttonClasses";
import { type Message } from "../helpers/types";
import { getMessage, nextId } from "../helpers/functions";
import Link from "next/link";
import { primaryButtonBase } from "./buttonClasses";

interface DialogueUncontrolledProps {
  systemPrompt: string;
  userPrompt: string;
  modelA: string;
  modelB: string;
  maxRounds: number;
  onClose?: () => void;
}

type StreamEvent = {
  type: "turn-start" | "delta" | "turn-end" | "complete" | "error";
  speaker?: "A" | "B";
  content?: string;
  turn?: number;
  error?: string;
};

export function DialogueUncontrolled({
  systemPrompt,
  userPrompt,
  modelA,
  modelB,
  maxRounds,
  onClose,
}: DialogueUncontrolledProps) {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<"A" | "B" | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [completedTurns, setCompletedTurns] = useState(0);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [allowedRounds, setAllowedRounds] = useState(maxRounds);
  const [isComplete, setIsComplete] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const pullControllerRef = useRef<AbortController | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    startDialogue();

    return () => {
      if (controllerRef.current) controllerRef.current.abort();
      if (pullControllerRef.current) pullControllerRef.current.abort();
    };
  }, []);

  const startDialogue = async () => {
    setConversation([]);
    setError(null);
    setCurrentSpeaker(null);
    setCurrentTurn(0);
    setCompletedTurns(0);
    setCompletedRounds(0);
    setAllowedRounds(maxRounds);
    setIsStreaming(false);
    setIsComplete(false);
    setIsLoading(true);
    currentMessageIdRef.current = null;

    const pullController = new AbortController();
    pullControllerRef.current = pullController;

    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/ollama", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "",
          },
          signal: pullController.signal,
          body: JSON.stringify({ action: "start", model: modelA }),
        }),
        fetch("/api/ollama", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "",
          },
          signal: pullController.signal,
          body: JSON.stringify({ action: "start", model: modelB }),
        }),
      ]);

      if (pullController.signal.aborted) {
        setIsLoading(false);
        pullControllerRef.current = null;
        return;
      }

      if (!resA.ok) {
        const dataA = await resA.json();
        throw new Error(`Model A (${modelA}): ${dataA?.error ?? "Failed to start"}`);
      }

      if (!resB.ok) {
        const dataB = await resB.json();
        throw new Error(`Model B (${modelB}): ${dataB?.error ?? "Failed to start"}`);
      }
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError") ||
        pullController.signal.aborted;

      if (!isAbort) {
        setError(getMessage(err));
      }
      setIsLoading(false);
      pullControllerRef.current = null;
      return;
    }

    setIsLoading(false);
    pullControllerRef.current = null;

    const userMessage: Message = {
      id: nextId("user"),
      role: "user",
      content: userPrompt.trim(),
    };

    setConversation([userMessage]);
    await runClashDialogue(maxRounds, 1);
  };

  const runClashDialogue = async (rounds: number, startTurn: number) => {
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch("/api/clash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          modelA,
          modelB,
          systemPrompt,
          userPrompt,
          maxRounds: rounds,
          startFromTurn: startTurn,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? "Failed to start dialogue");
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
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event: StreamEvent = JSON.parse(trimmed);
            handleStreamEvent(event);
          } catch (parseErr) {
            console.warn("Failed to parse event:", trimmed);
          }
        }
      }
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError") ||
        controller.signal.aborted;

      if (!isAbort) {
        setError(getMessage(err));
      }
    } finally {
      setIsStreaming(false);
      setCurrentSpeaker(null);
      controllerRef.current = null;
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case "turn-start":
        if (event.speaker && event.turn) {
          setCurrentSpeaker(event.speaker);
          setCurrentTurn(event.turn);

          if (!currentMessageIdRef.current) {
            const msgId = nextId("assistant");
            currentMessageIdRef.current = msgId;

            const newMessage: Message = {
              id: msgId,
              role: "assistant",
              content: "",
            };

            setConversation((prev) => [...prev, newMessage]);
          }
        }
        break;

      case "delta":
        if (event.content && currentMessageIdRef.current) {
          const msgId = currentMessageIdRef.current;
          setConversation((prev) =>
            prev.map((msg) => (msg.id === msgId ? { ...msg, content: msg.content + event.content } : msg))
          );
        }
        break;

      case "turn-end":
        if (event.turn) {
          setCompletedTurns(event.turn);
          setCompletedRounds(Math.ceil(event.turn / 2));
        }
        currentMessageIdRef.current = null;
        setCurrentSpeaker(null);
        break;

      case "complete":
        setIsComplete(true);
        setIsStreaming(false);
        setCurrentSpeaker(null);
        break;

      case "error":
        if (event.error) {
          setError(event.error);
        }
        setIsStreaming(false);
        setCurrentSpeaker(null);
        break;
    }
  };

  const handleStop = () => {
    if (pullControllerRef.current) pullControllerRef.current.abort();
    if (controllerRef.current) controllerRef.current.abort();
    setIsStreaming(false);
    setIsLoading(false);
    setCurrentSpeaker(null);
  };

  const handleContinue = () => {
    const newAllowedRounds = allowedRounds + maxRounds;
    setAllowedRounds(newAllowedRounds);
    setIsComplete(false);
    runClashDialogue(newAllowedRounds, completedTurns + 1);
  };

  const handleRestart = () => {
    if (pullControllerRef.current) pullControllerRef.current.abort();
    if (controllerRef.current) controllerRef.current.abort();

    setConversation([]);
    setError(null);
    setCurrentTurn(0);
    setCompletedTurns(0);
    setCompletedRounds(0);
    setIsComplete(false);
    setAllowedRounds(maxRounds);
    currentMessageIdRef.current = null;

    startDialogue();
  };

  const handleReset = () => {
    if (pullControllerRef.current) pullControllerRef.current.abort();
    if (controllerRef.current) controllerRef.current.abort();

    onClose?.();
  };

  const canContinue = isComplete && !isStreaming && !isLoading && conversation.length;
  const canRestart = isComplete && !isStreaming && !isLoading && conversation.length;
  const canStop = isStreaming || isLoading;
  const canReset = !isStreaming && !isLoading && conversation.length;

  const CallJudge = () => {
    return isComplete && conversation.length ? (
      <div className="w-full mt-3 mb-2 text-center">
        <Link href="/judge" className={`${primaryButtonBase} bg-red-800`}>
          Call the judge
        </Link>
      </div>
    ) : null;
  };

  return (
    <section className="flex w-full flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#0b0b0b]">
      <header className="flex flex-col gap-2 text-center">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">AI-to-AI Dialogue</h3>
          <div className="flex gap-2">
            {canContinue && (
              <button onClick={handleContinue} className={secondaryButtonClass}>
                Continue... (+{maxRounds} rounds)
              </button>
            )}
            {canRestart && (
              <button onClick={handleRestart} className={secondaryButtonClass}>
                Restart
              </button>
            )}
            <button
              onClick={canStop ? handleStop : handleReset}
              className={secondaryButtonClass}
              disabled={!canStop && !canReset}
            >
              {canStop ? "Stop" : "Reset"}
            </button>
          </div>
        </div>
        {CallJudge()}
        <span className="text-sm text-sky-700 dark:text-sky-400">
          {isLoading
            ? "Pulling models..."
            : isStreaming && currentSpeaker
            ? `Model ${currentSpeaker} responding... (round ${Math.round(currentTurn / 2)}/${allowedRounds})`
            : isComplete
            ? `Complete (${completedRounds} rounds)`
            : null}
        </span>
        {error && (
          <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </header>

      <ConversationLayout conversation={conversation} useModelLabels={true} labelA="Model A" labelB="Model B" />
      {CallJudge()}
    </section>
  );
}

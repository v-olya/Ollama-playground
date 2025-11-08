"use client";
import { useEffect, useRef, useState } from "react";
import { type ChatPanelHandle } from "../helpers/types";
import { ChatPanel } from "./ChatPanel";
import { SendButton } from "./SendButton";
import { PromptTextarea } from "./PromptTextarea";
import { ModelSelectionProvider, useModelSelection } from "../contexts/ModelSelectionContext";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Provide a clear, concise, and well-formatted response. When appropriate, add examples, explanations, and code snippets. Prioritize correctness, readability, and relevance.";
const DEFAULT_USER_PROMPT = "What is the difference between 'ollama run' and 'ollama serve' commands?";

export default function TwoChatsLayout() {
  return (
    <ModelSelectionProvider>
      <TwoChatsLayoutContent />
    </ModelSelectionProvider>
  );
}

function TwoChatsLayoutContent() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const chatA = useRef<ChatPanelHandle | null>(null);
  const chatB = useRef<ChatPanelHandle | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const { chatStatus, selectedA, selectedB } = useModelSelection();
  const disableMultipleSending =
    isRestarting ||
    chatStatus.A.isLoading ||
    chatStatus.A.isThinking ||
    chatStatus.B.isLoading ||
    chatStatus.B.isThinking;

  // Track current models for cleanup on unmount
  const currentModelsRef = useRef<{ A: string | null; B: string | null }>({ A: null, B: null });

  // Keep the ref in sync with selected models
  useEffect(() => {
    currentModelsRef.current = { A: selectedA, B: selectedB };
  }, [selectedA, selectedB]);

  async function restartChats() {
    if (isRestarting) return;
    setIsRestarting(true);
    try {
      const tasks: Promise<void>[] = [];
      if (chatA.current) tasks.push(chatA.current.resetSession());
      if (chatB.current) tasks.push(chatB.current.resetSession());
      if (tasks.length) {
        await Promise.all(tasks);
      }
    } finally {
      setIsRestarting(false);
    }
  }

  // Cleanup all active processes when component unmounts (page navigation/refresh)
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "";

    return () => {
      // Stop all active models (using ref to avoid re-running on every change)
      const { A: modelA, B: modelB } = currentModelsRef.current;
      const modelsToStop = [modelA, modelB].filter(Boolean) as string[];

      modelsToStop.forEach((model) => {
        // Fire-and-forget stop requests
        fetch("/api/ollama", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ action: "stop", model }),
          keepalive: true, // Ensure request completes even after page unload
        }).catch(() => {
          // Ignore errors during cleanup
        });
      });
    };
  }, []); // Only run on mount/unmount

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 grid gap-4">
        <PromptTextarea
          label="System prompt"
          value={systemPrompt}
          onChange={setSystemPrompt}
          restartChats={restartChats}
        />
        <PromptTextarea label="User prompt" value={userPrompt} onChange={setUserPrompt} restartChats={restartChats} />
      </div>
      <div className="mb-4 flex items-center justify-end">
        <SendButton
          onClick={() => {
            chatA.current?.triggerSend();
            chatB.current?.triggerSend();
          }}
          disabled={disableMultipleSending}
        >
          Send to both
        </SendButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChatPanel ref={chatA} key="A" mode="A" systemPrompt={systemPrompt} userPrompt={userPrompt} />
        <ChatPanel ref={chatB} key="B" mode="B" systemPrompt={systemPrompt} userPrompt={userPrompt} />
      </div>
    </div>
  );
}

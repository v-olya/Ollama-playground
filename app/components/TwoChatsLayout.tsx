"use client";
import { useRef, useState } from "react";
import { type ChatPanelHandle } from "../helpers/types";
import { ChatPanel } from "./ChatPanel";
import { SendButton } from "./SendButton";
import { PromptTextarea } from "./PromptTextarea";
import { ModelSelectionProvider, useModelSelection } from "../contexts/ModelSelectionContext";
import { secondaryButtonClass } from "../helpers/buttonClasses";
import { confirmBeforeChange } from "../helpers/functions";

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
  const { chatStatus } = useModelSelection();
  const isBusy = chatStatus.A.isLoading || chatStatus.A.isThinking || chatStatus.B.isLoading || chatStatus.B.isThinking;
  const disableMultipleSending = isRestarting || isBusy;
  const shouldConfirmPrompts = chatStatus.A.hasHistory || chatStatus.B.hasHistory || isBusy;

  const handleResetPrompts = () => {
    if (disableMultipleSending) return;
    const applyDefaults = () => {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
    };
    if (!shouldConfirmPrompts) {
      applyDefaults();
      return;
    }
    const confirmed = confirmBeforeChange(() => {
      void restartChats();
    });
    if (!confirmed) return;
    applyDefaults();
  };

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

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 grid gap-4">
        <PromptTextarea
          label="System prompt"
          value={systemPrompt}
          onChange={setSystemPrompt}
          restartChats={shouldConfirmPrompts ? restartChats : undefined}
        />
        <PromptTextarea
          label="User prompt"
          value={userPrompt}
          onChange={setUserPrompt}
          restartChats={shouldConfirmPrompts ? restartChats : undefined}
        />
      </div>
      <div className="mb-4 flex items-center justify-end gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={handleResetPrompts}
          disabled={disableMultipleSending}
        >
          Reset prompts
        </button>
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

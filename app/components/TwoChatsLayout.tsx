"use client";
import { useRef, useState } from "react";
import { type ChatPanelHandle } from "../helpers/types";
import { ChatPanel } from "./ChatPanel";
import SendButton from "./SendButton";
import PromptTextarea from "./PromptTextarea";

const MODEL_OPTIONS = [
  { value: "qwen2.5-coder:7b" },
  { value: "qwen3-coder:480b-cloud" },
  {
    value: "gpt-oss:120b-cloud",
  },
  {
    value: "gpt-oss:20b-cloud",
  },
  {
    value: "deepseek-v3.1:671b-cloud",
  },
  {
    value: "qwen3-vl:235b-cloud",
  },
  {
    value: "minimax-m2:cloud",
  },
  {
    value: "glm-4.6:cloud",
  },
  {
    value: "kimi-k2:1t-cloud",
  },
  {
    value: "gemma3:4b",
  },
  {
    value: "codegemma:7b-instruct-v1.1-q4_0",
  },
];

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Provide a clear, concise, and well-formatted response. When appropriate, add examples, explanations, and code snippets. Prioritize correctness, readability, and relevance.";
const DEFAULT_USER_PROMPT =
  "What is the difference between 'ollama run' and 'ollama serve' commands?";

export default function TwoChatsLayout() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const leftRef = useRef<ChatPanelHandle | null>(null);
  const rightRef = useRef<ChatPanelHandle | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  async function restartChats() {
    if (isRestarting) return;
    setIsRestarting(true);
    try {
      const tasks: Promise<void>[] = [];
      if (leftRef.current) tasks.push(leftRef.current.resetSession());
      if (rightRef.current) tasks.push(rightRef.current.resetSession());
      if (tasks.length) {
        await Promise.all(tasks);
      }
    } finally {
      setIsRestarting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-6 grid gap-4">
        <PromptTextarea
          label="System prompt"
          value={systemPrompt}
          onChange={setSystemPrompt}
          restartChats={restartChats}
        />
        <PromptTextarea
          label="User prompt"
          value={userPrompt}
          onChange={setUserPrompt}
          restartChats={restartChats}
        />
      </div>
      <div className="mb-4 flex items-center justify-end">
        <SendButton
          onClick={() => {
            leftRef.current?.triggerSend();
            rightRef.current?.triggerSend();
          }}
        >
          Send to all
        </SendButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChatPanel
          ref={leftRef}
          mode="primary"
          modelOptions={MODEL_OPTIONS}
          defaultModel={MODEL_OPTIONS[0].value}
          systemPrompt={systemPrompt}
          userPrompt={userPrompt}
        />
        <ChatPanel
          ref={rightRef}
          mode="secondary"
          modelOptions={MODEL_OPTIONS}
          defaultModel={MODEL_OPTIONS[1].value}
          systemPrompt={systemPrompt}
          userPrompt={userPrompt}
        />
      </div>
    </div>
  );
}

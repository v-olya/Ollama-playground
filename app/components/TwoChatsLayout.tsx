"use client";

import React, { useState } from "react";
import ChatPanel, { Message } from "./ChatPanel";

export default function TwoChatsLayout() {
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant. Provide concise answers."
  );
  const [userPrompt, setUserPrompt] = useState(
    "Explain the key differences between two similar commands."
  );

  // track whether initial send happened; once true both panels become independent
  const [initialSent, setInitialSent] = useState(false);

  const [leftMessages, setLeftMessages] = useState<Message[]>([]);
  const [rightMessages, setRightMessages] = useState<Message[]>([]);

  function handleInitialSend() {
    // build initial messages for each side using shared prompts
    const systemMsg: Message = {
      id: `s-${Date.now()}`,
      role: "system",
      content: systemPrompt,
    };
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userPrompt,
    };
    // seed both panels; later they accept independent input
    setLeftMessages([systemMsg, userMsg]);
    setRightMessages([systemMsg, userMsg]);
    setInitialSent(true);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-6 grid gap-4">
        <label className="flex w-full flex-col gap-2">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-right">
            System prompt
          </div>
          <textarea
            className="h-20 w-full rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </label>

        <label className="flex w-full flex-col gap-2">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-right">
            User prompt
          </div>
          <textarea
            className="h-20 w-full rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
          />
        </label>

        <div className="flex w-full items-center justify-end">
          <button
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-80"
            onClick={handleInitialSend}
            disabled={initialSent}
          >
            Send to both
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChatPanel
          title="Model A"
          initialMessages={leftMessages}
          disabled={!initialSent}
          onSendLocal={(m) => setLeftMessages((s) => [...s, m])}
        />
        <ChatPanel
          title="Model B"
          initialMessages={rightMessages}
          disabled={!initialSent}
          onSendLocal={(m) => setRightMessages((s) => [...s, m])}
        />
      </div>
    </div>
  );
}

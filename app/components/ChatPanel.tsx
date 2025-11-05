"use client";

import React, { useState } from "react";

export interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

export default function ChatPanel({
  title,
  initialMessages = [],
  disabled = true,
  onSendLocal,
}: {
  title: string;
  initialMessages?: Message[];
  disabled?: boolean;
  onSendLocal?: (msg: Message) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    const msg: Message = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
      role: "user",
      content: input.trim(),
    };
    setMessages((m) => [...m, msg]);
    setInput("");
    onSendLocal?.(msg);
  }

  return (
    <section className="w-full rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#0b0b0b]">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
        {title}
      </h3>

      <div className="mb-3 max-h-64 space-y-2 overflow-auto pr-2">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500">No messages yet.</div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "assistant"
                ? "rounded-md bg-zinc-100 p-2 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                : "rounded-md bg-zinc-50 p-2 text-zinc-900 dark:bg-[#111] dark:text-zinc-200"
            }
          >
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {m.role}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            disabled ? "Waiting for initial send..." : "Type your message"
          }
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={send}
          disabled={disabled}
        >
          Send
        </button>
      </div>
    </section>
  );
}

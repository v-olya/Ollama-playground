"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import SendButton from "./SendButton";
import { ActionKey, Message, ModeKey, nextId } from "../helpers/types";

const sendAction = (action: ActionKey, model: string, mode: ModeKey) =>
  fetch("/api/ollama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY || "",
    },
    body: JSON.stringify({ action, model, mode }),
  });

interface ChatPanelProps {
  modelOptions: {
    value: string;
  }[];
  defaultModel: string;
  systemPrompt: string;
  userPrompt: string;
  mode: ModeKey;
}

export const ChatPanel = forwardRef(function ChatPanel(
  {
    modelOptions,
    defaultModel,
    systemPrompt,
    userPrompt,
    mode,
  }: ChatPanelProps,
  ref
) {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const A_B = mode === "primary" ? "A" : "B";

  async function send() {
    const sessionId = sessionRef.current;
    // prefer typed input; if empty, fall back to the shared user prompt
    const trimmed = input.trim() || userPrompt.trim();
    console.log("Sending message in mode:", mode, selectedModel);
    if (!trimmed || !selectedModel) return;

    const userMessage: Message = {
      id: nextId("user"),
      role: "user",
      content: trimmed,
    };

    const nextConversation = [...conversation, userMessage];
    setConversation((prev) => {
      if (sessionRef.current !== sessionId) return prev;
      return nextConversation;
    });
    setInput("");
    setIsLoading(true);
    setError(null);

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...nextConversation.map(({ role, content }) => ({ role, content })),
    ];

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: payloadMessages,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to fetch model response.");
      }

      if (typeof data?.text !== "string") {
        throw new Error("Model response did not include text output.");
      }

      const assistantMessage: Message = {
        id: nextId("assistant"),
        role: "assistant",
        content: data.text,
      };
      setConversation((prev) => {
        if (sessionRef.current !== sessionId) return prev;
        return [...prev, assistantMessage];
      });
    } catch (err) {
      if (sessionRef.current !== sessionId) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (sessionRef.current === sessionId) {
        setIsLoading(false);
      }
    }
  }

  // expose a simple imperative handle so parent can trigger a send
  useImperativeHandle(
    ref,
    () => ({
      triggerSend: async () => {
        try {
          setIsLoading(true);
          console.log("Triggering send in mode:", mode, selectedModel);
          await sendAction("start", selectedModel, mode);
          void send();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
      },
      resetSession: async () => {
        sessionRef.current += 1;
        setConversation([]);
        setInput("");
        setError(null);

        const activeModel = selectedModel;
        if (!activeModel) {
          setIsLoading(false);
          return;
        }

        try {
          setIsLoading(true);
          await sendAction("stop", activeModel, mode);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
      },
    }),
    [mode, selectedModel]
  );

  return (
    <section className="flex h-full w-full flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#0b0b0b]">
      <header className="flex flex-col gap-2 text-center">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`model${A_B}`}
            className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Model {A_B}
          </label>
          <div className="flex items-center gap-2">
            <select
              id={`model${A_B}`}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-700 dark:bg-transparent"
              value={selectedModel}
              onChange={async (e) => {
                const newModel = e.target.value;
                const prevModel = selectedModel;
                // Optimistically update selection
                setSelectedModel(newModel);
                setIsLoading(true);
                setError(null);
                try {
                  // stop previous model for this panel's mode
                  if (prevModel) {
                    await sendAction("stop", prevModel, mode);
                  }
                  // start new model for this panel's mode
                  await sendAction("start", newModel, mode);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                disabled={!isLoading}
                onClick={async () => {
                  if (!selectedModel) return;
                  setError(null);
                  try {
                    await sendAction("stop", selectedModel, mode);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
        {isLoading && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            Running…
          </span>
        )}
        {error && (
          <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-auto rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
        {conversation.length === 0 && (
          <div className="text-sm text-zinc-500">No messages yet</div>
        )}
        {conversation.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "assistant"
                ? "rounded-md bg-zinc-100 p-2 text-left text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                : message.role === "system"
                ? "rounded-md bg-zinc-200/60 p-2 text-left text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                : "rounded-md bg-zinc-50 p-2 text-left text-zinc-900 dark:bg-[#111] dark:text-zinc-200"
            }
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              {message.role}
            </div>
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <input
          className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your query"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <SendButton onClick={send} disabled={isLoading || !selectedModel}>
          Send
        </SendButton>
      </div>
    </section>
  );
});

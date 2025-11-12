"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { SendButton } from "./SendButton";
import { SelectWithDisabled } from "./SelectWithDisabled";
import { ConversationLayout } from "./ConversationLayout";
import { type ActionKey, type Message } from "../helpers/types";
import { CODING_MODELS, useModelSelection } from "../contexts/ModelSelectionContext";
import { getMessage, nextId, isAbortError, sendOllamaAction, extractResponseError } from "../helpers/functions";
import { secondaryButtonClass, formInput, card } from "../helpers/twClasses";

interface ChatPanelProps {
  systemPrompt: string;
  userPrompt: string;
  mode: "A" | "B";
}

export const ChatPanel = forwardRef(function ChatPanel({ systemPrompt, userPrompt, mode }: ChatPanelProps, ref) {
  const { selectedA, selectedB, setSelectedA, setSelectedB, setChatStatus } = useModelSelection();
  const selectedModel = mode === "A" ? selectedA : selectedB;
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const pendingStartRef = useRef<{ model: string; controller: AbortController } | null>(null);
  const runningModelRef = useRef<string | null>(null);

  const sendAction = useCallback(
    async (
      action: ActionKey,
      model: string | null | undefined,
      options?: { keepalive?: boolean }
    ): Promise<{ aborted: boolean }> => {
      if (!model) {
        return { aborted: false };
      }

      if (action === "stop") {
        const pending = pendingStartRef.current;
        if (pending && pending.model === model) {
          const alreadyAborted = pending.controller.signal.aborted;
          if (!alreadyAborted) {
            pending.controller.abort();
            pendingStartRef.current = null;
            return { aborted: true };
          }
          pendingStartRef.current = null;
        }
      }

      const controller = action === "start" ? new AbortController() : null;

      if (controller) {
        pendingStartRef.current?.controller.abort();
        pendingStartRef.current = { model, controller };
      }

      try {
        const result = await sendOllamaAction(action, model, {
          signal: controller?.signal,
          keepalive: options?.keepalive,
        });
        if (result.aborted || controller?.signal.aborted) return { aborted: true };

        const res = result.response;
        if (!res?.ok) {
          const errorMessage =
            (await extractResponseError(res)) ?? `Request failed with status ${res?.status ?? "unknown"}`;
          throw new Error(errorMessage);
        }

        return { aborted: false };
      } catch (err) {
        const aborted = !!controller?.signal.aborted || isAbortError(err);
        if (aborted) {
          return { aborted: true };
        }
        throw err;
      } finally {
        if (controller && pendingStartRef.current?.controller === controller) {
          pendingStartRef.current = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    setChatStatus((prev) => ({
      ...prev,
      [mode]: { isLoading, isThinking, hasHistory: conversation.length > 0, error },
    }));
    return () => {
      setChatStatus((prev) => ({
        ...prev,
        [mode]: { isLoading: false, isThinking: false, hasHistory: false, error: null },
      }));
    };
  }, [mode, isLoading, isThinking, conversation.length, error, setChatStatus]);

  useEffect(() => {
    return () => {
      generationControllerRef.current?.abort();
      const pending = pendingStartRef.current;
      if (pending) {
        pending.controller.abort();
        pendingStartRef.current = null;
      }
      const modelToStop = runningModelRef.current;
      if (modelToStop) {
        sendAction("stop", modelToStop, { keepalive: true }).catch(() => {
          // ignore cleanup failures
        });
        runningModelRef.current = null;
      }
    };
  }, [sendAction]);

  const send = useCallback(
    async (options?: { resetConversation?: boolean }) => {
      const runModel = selectedModel;
      const trimmed = input.trim() || userPrompt.trim();
      if (!trimmed || !runModel) {
        return false;
      }

      const baseConversation = options?.resetConversation ? [] : conversation;
      if (options?.resetConversation) {
        setConversation([]);
      }

      const userMessage: Message = {
        id: nextId("user"),
        role: "user",
        content: trimmed,
      };

      setInput("");
      setError(null);
      const shouldAppendUser = (() => {
        const last = baseConversation[baseConversation.length - 1];
        return !(last && last.role === "user" && last.content === trimmed);
      })();
      const nextConversation = shouldAppendUser ? [...baseConversation, userMessage] : baseConversation;

      try {
        setIsLoading(true);
        const result = await sendAction("start", runModel);
        if (result.aborted) {
          return false;
        }
        runningModelRef.current = runModel;
        setConversation(nextConversation);
      } catch (err) {
        const message = getMessage(err);
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }

      const payloadMessages = [{ role: "system", content: systemPrompt }, ...nextConversation];
      if (process.env.NODE_ENV !== "production") {
        console.log("Payload messages:", payloadMessages);
      }

      generationControllerRef.current?.abort();
      const controller = new AbortController();
      generationControllerRef.current = controller;
      setIsThinking(true);
      let streamed = false;

      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: runModel,
            messages: payloadMessages,
          }),
        });

        if (controller.signal.aborted) {
          return false;
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
              setConversation((prev) =>
                prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: latest } : m))
              );
            }
          }
          streamed = true;
        }

        if (!streamed) {
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
          setConversation((prev) => [...prev, assistantMessage]);
        }

        return true;
      } catch (err) {
        const isAbort = isAbortError(err) || controller.signal.aborted;
        if (isAbort) {
          return false;
        }
        const message = getMessage(err);
        setError(message);
        return false;
      } finally {
        if (generationControllerRef.current === controller) {
          generationControllerRef.current = null;
        }
        setIsThinking(false);
        if (runningModelRef.current === runModel) {
          runningModelRef.current = null;
        }
      }
    },
    [conversation, input, selectedModel, sendAction, systemPrompt, userPrompt]
  );

  useImperativeHandle(
    ref,
    () => ({
      triggerSend: async () => send({ resetConversation: true }),
      resetSession: async () => {
        setConversation([]);
        setInput("");
        setError(null);
        setIsThinking(false);

        const pending = pendingStartRef.current;
        if (pending) {
          pending.controller.abort();
          pendingStartRef.current = null;
        }

        generationControllerRef.current?.abort();
        generationControllerRef.current = null;

        if (!selectedModel) {
          return;
        }
        try {
          setIsLoading(true);
          await sendAction("stop", selectedModel);
        } catch (err) {
          setError(getMessage(err));
        } finally {
          if (runningModelRef.current === selectedModel) {
            runningModelRef.current = null;
          }
          setIsLoading(false);
        }
      },
      isLoading,
      isThinking,
    }),
    [isLoading, isThinking, selectedModel, send, sendAction]
  );

  return (
    <section className={`flex h-full w-full flex-col gap-3 ${card}`}>
      <header className="flex flex-col gap-2 text-center">
        <div className="flex flex-col gap-1 text-right">
          <label htmlFor={`model${mode}`} className="py-1 tracking-wide text-xs font-semibold uppercase text-zinc-500">
            Model {mode}
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <SelectWithDisabled
              id={`model${mode}`}
              value={selectedModel}
              options={CODING_MODELS}
              onChange={async (newModel) => {
                const prevModel = selectedModel;
                (mode === "A" ? setSelectedA : setSelectedB)(newModel);
                setIsThinking(false);
                setError(null);
                try {
                  setIsLoading(true);
                  if (prevModel) {
                    try {
                      await sendAction("stop", prevModel);
                      if (runningModelRef.current === prevModel) {
                        runningModelRef.current = null;
                      }
                    } catch {
                      console.warn(`Failed to stop previous model ${prevModel}`);
                    }
                  }
                  await sendAction("start", newModel);
                } catch (err) {
                  setError(getMessage(err));
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="flex-1 min-w-0"
              disabledOption={mode === "A" ? selectedB : selectedA}
            />
            <div className="flex items-center shrink-0">
              <button
                className={`${secondaryButtonClass} shrink-0`}
                disabled={!selectedModel}
                onClick={async () => {
                  if (!selectedModel) return;
                  setError(null);
                  try {
                    generationControllerRef.current?.abort();
                    setIsThinking(false);
                    await sendAction("stop", selectedModel);
                  } catch (err) {
                    setError(getMessage(err));
                  } finally {
                    if (runningModelRef.current === selectedModel) {
                      runningModelRef.current = null;
                    }
                    setIsLoading(false);
                  }
                }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
        <span className="text-sm text-sky-700">{isLoading ? "Loading…" : isThinking ? "Responding…" : null}</span>
        {error && <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
      </header>

      <ConversationLayout conversation={conversation} />

      <div className="mt-1 flex gap-3">
        <input
          className={`flex-1 ${formInput}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your query"
          disabled={isLoading || isThinking}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && !isThinking) {
                void send();
              }
            }
          }}
        />
        <SendButton
          onClick={() => {
            void send();
          }}
          disabled={isLoading || isThinking || !selectedModel}
        >
          {isThinking ? "Generating…" : "Send"}
        </SendButton>
      </div>
    </section>
  );
});

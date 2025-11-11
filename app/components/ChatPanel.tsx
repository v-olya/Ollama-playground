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
  // controller for aborting a generation request
  const generationControllerRef = useRef<AbortController | null>(null);
  const pendingStartRef = useRef<{ model: string; controller: AbortController } | null>(null);
  // Track if the model is actually running (not just loading)
  const runningModelRef = useRef<string | null>(null);
  const skipNextStartRef = useRef(false);

  const sendAction = useCallback(
    async (
      action: ActionKey,
      model: string | null | undefined,
      options?: { keepalive?: boolean }
    ): Promise<{ aborted: boolean }> => {
      if (!model) {
        return { aborted: false };
      }

      // If we have a pending start for the model we're trying to stop,
      // abort the pending controller and avoid sending an extra network stop when the start hasn't completed.
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

      // Create a controller only for start requests so we can cancel a pending start.
      const controller = action === "start" ? new AbortController() : null;

      if (controller) {
        // Cancel any previously pending start and record this one.
        pendingStartRef.current?.controller.abort();
        pendingStartRef.current = { model, controller };
      }

      try {
        // The shared helper returns { aborted, response }.
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
        // sendOllamaAction should've returned { aborted: true } for AbortErrors,
        // but ... double-check here.
        const aborted = !!controller?.signal.aborted || isAbortError(err);
        if (aborted) {
          return { aborted: true };
        }
        throw err;
      } finally {
        // Clear pendingStartRef only if it's still pointing at our controller.
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
      [mode]: { isLoading, isThinking, hasHistory: conversation.length },
    }));
    return () => {
      setChatStatus((prev) => ({
        ...prev,
        [mode]: { isLoading: false, isThinking: false, hasHistory: false },
      }));
    };
  }, [mode, isLoading, isThinking, conversation.length, setChatStatus]);

  // Cleanup on unmount: abort any in-flight requests and stop the model
  useEffect(() => {
    return () => {
      generationControllerRef.current?.abort();
      if (pendingStartRef.current) {
        pendingStartRef.current.controller.abort();
        pendingStartRef.current = null;
      }
      // FE should still dispatch "stop" to cover the gap where the server never saw a /compare run
      // Only send a request if a model is actually running (to save keep-alive requests)
      const modelToStop = runningModelRef.current;
      if (modelToStop) {
        sendAction("stop", modelToStop, { keepalive: true }).catch(() => {
          // Ignore errors during cleanup
        });
        runningModelRef.current = null;
      }
    };
  }, [sendAction]);

  const send = useCallback(async () => {
    const runModel = selectedModel;
    // prefer hand-typed input, fall back to the shared user prompt if empty
    const trimmed = input.trim() || userPrompt.trim();
    if (!trimmed || !runModel) return;

    const userMessage: Message = {
      id: nextId("user"),
      role: "user",
      content: trimmed,
    };
    // Don't append the user message until the model is confirmed to be running
    let nextConversation: Message[] = [];
    setInput("");
    setError(null);

    // Check and pull (if needed) before sending
    try {
      setIsLoading(true);
      if (skipNextStartRef.current) {
        // Send already started the model
        skipNextStartRef.current = false;
      } else {
        const result = await sendAction("start", runModel);
        if (result.aborted) {
          return;
        }
        // Model is now loaded and ready
        runningModelRef.current = runModel;
      }
      // Guard against adding the same user prompt twice in a row
      setConversation((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.role === "user" && last.content === userMessage.content) {
            nextConversation = prev;
            return prev;
          }
        }
        nextConversation = [...prev, userMessage];
        return nextConversation;
      });
    } catch (err) {
      setError(getMessage(err));
      return;
    } finally {
      setIsLoading(false);
    }

    const payloadMessages = [{ role: "system", content: systemPrompt }, ...nextConversation, userMessage];
    if (process.env.NODE_ENV !== "production") {
      console.log("Payload messages:", payloadMessages);
    }
    // Abort the previous generation before start
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

      // If aborted immediately, exit silently
      if (controller.signal.aborted) {
        return;
      }

      // Streaming response handling (text/plain chunks)
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
              break; // allow outer finally to run
            }
            acc += decoder.decode(value, { stream: true });
            const latest = acc;
            setConversation((prev) => prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: latest } : m)));
          }
        }
        streamed = true; // streaming handled
      }

      if (!streamed) {
        // Fallback: JSON response with full text
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
    } catch (err) {
      const isAbort = isAbortError(err) || controller.signal.aborted;
      if (isAbort) {
        // user-triggered abort; don't surface as an error
        return;
      }
      setError(getMessage(err));
    } finally {
      // Only clear thinking state if this is still the active controller
      if (generationControllerRef.current === controller) {
        setIsThinking(false);
        generationControllerRef.current = null;
        if (runningModelRef.current === runModel) {
          runningModelRef.current = null;
        }
      }
    }
  }, [input, selectedModel, systemPrompt, userPrompt, sendAction]);

  // expose an imperative handle so parent can trigger actions
  useImperativeHandle(
    ref,
    () => ({
      triggerSend: async () => {
        setConversation([]);
        setError(null);
        let abortedStart = false;
        try {
          setIsLoading(true);
          const result = await sendAction("start", selectedModel);
          abortedStart = result.aborted;
        } catch (err) {
          setError(getMessage(err));
          abortedStart = true;
        } finally {
          setIsLoading(false);
        }
        if (!abortedStart) {
          skipNextStartRef.current = true;
          await send();
        }
      },
      isLoading: isLoading,
      isThinking: isThinking,
      resetSession: async () => {
        setConversation([]);
        setInput("");
        setError(null);
        setIsThinking(false);
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

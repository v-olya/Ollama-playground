export const getMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export function confirmBeforeChange(restartChats?: () => void) {
  const confirmed = window.confirm(
    "Attention: this change will clear the current chat.\nAre you sure you want to restart?"
  );
  if (!confirmed) return false;
  if (restartChats) restartChats();
  return true;
}

// Send a request to the /api/ollama endpoint. Returns { aborted } on Abort.
export async function sendOllamaAction(
  action: "start" | "stop",
  model: string | null | undefined,
  options?: { signal?: AbortSignal; keepalive?: boolean }
): Promise<{ aborted: boolean; response?: Response }> {
  if (!model) {
    return { aborted: false };
  }

  try {
    const res = await fetch("/api/ollama", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_OLLAMA_API_KEY ? { "X-API-Key": process.env.NEXT_PUBLIC_OLLAMA_API_KEY } : {}),
      },
      body: JSON.stringify({ action, model }),
      signal: options?.signal,
      keepalive: options?.keepalive,
    });

    if (!res.ok) {
      // Let caller handle non-OK if desired; include response for inspection
      return { aborted: false, response: res };
    }

    return { aborted: false, response: res };
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError");
    if (aborted) return { aborted: true };
    throw err;
  }
}

// Helper to detect an AbortError in a cross-browser-friendly way
export const isAbortError = (err: unknown): boolean =>
  (typeof DOMException !== "undefined" && err instanceof DOMException && (err as DOMException).name === "AbortError") ||
  (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError");

export type ActionKey = "start" | "stop";

export interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatPanelHandle = {
  triggerSend: () => void;
  resetSession: () => Promise<void>;
};

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

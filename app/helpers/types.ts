export type ActionKey = "start" | "stop";

export interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatPanelHandle = {
  triggerSend: () => void;
  resetSession: () => Promise<void>;
  isLoading: boolean;
  isThinking: boolean;
};

"use client";
import { createContext, useContext, useState } from "react";

export type PanelMode = "A" | "B";
export type PanelStatus = {
  isLoading: boolean;
  isThinking: boolean;
  hasHistory: boolean;
};

type ModelSelection = {
  selectedA: string;
  selectedB: string;
  setSelectedA: (model: string) => void;
  setSelectedB: (model: string) => void;
  chatStatus: Record<PanelMode, PanelStatus>;
  setChatStatus: React.Dispatch<React.SetStateAction<Record<PanelMode, PanelStatus>>>;
};

export const MODEL_OPTIONS = [
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

export const THINKING_MODELS = [
  { value: "qwen3-coder:480b-cloud" },
  {
    value: "gpt-oss:120b-cloud",
  },
  {
    value: "gpt-oss:20b-cloud",
  },
];
const ModelSelectionContext = createContext<ModelSelection | undefined>(undefined);

export function useModelSelection() {
  const context = useContext(ModelSelectionContext);
  if (!context) throw new Error("useModelSelection can only be used inside ModelSelectionProvider");
  return context;
}

export function ModelSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedA, setSelectedA] = useState(MODEL_OPTIONS[0].value);
  const [selectedB, setSelectedB] = useState(MODEL_OPTIONS[1].value);
  const [chatStatus, setChatStatus] = useState<Record<PanelMode, PanelStatus>>({
    A: { isLoading: false, isThinking: false, hasHistory: false },
    B: { isLoading: false, isThinking: false, hasHistory: false },
  });

  return (
    <ModelSelectionContext.Provider
      value={{ selectedA, selectedB, setSelectedA, setSelectedB, chatStatus, setChatStatus }}
    >
      {children}
    </ModelSelectionContext.Provider>
  );
}

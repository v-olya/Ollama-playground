"use client";
import { createContext, useContext, useState } from "react";

export type PanelMode = "A" | "B";
export type PanelStatus = {
  isLoading: boolean;
  isThinking: boolean;
  hasHistory: boolean;
  error: string | null;
};

type ModelSelection = {
  selectedA: string;
  selectedB: string;
  setSelectedA: React.Dispatch<React.SetStateAction<string | "">>;
  setSelectedB: React.Dispatch<React.SetStateAction<string | "">>;
  chatStatus: Record<PanelMode, PanelStatus>;
  setChatStatus: React.Dispatch<React.SetStateAction<Record<PanelMode, PanelStatus>>>;
};

export type Option = { value: string };
export type ModelOptions = Option[];
export const DEFAULT_MODELS = [
  { value: "deepseek-v3.1:671b-cloud" },
  { value: "deepseek-r1:1.5b-qwen-distill-fp16" },
  { value: "gemma3:4b" },
  { value: "glm-4.6:cloud" },
  { value: "gpt-oss:120b-cloud" },
  { value: "gpt-oss:20b-cloud" },
  { value: "kimi-k2:1t-cloud" },
  { value: "minimax-m2:cloud" },
  { value: "qwen2.5-coder:7b" },
  { value: "qwen3-coder:480b-cloud" },
  { value: "qwen3-vl:235b-cloud" },
];

export const CODING_MODELS = [
  { value: "codegemma:7b-instruct-v1.1-q4_0" },
  { value: "deepseek-coder:6.7b" },
  { value: "deepseek-coder:1.3b-instruct-fp16" },
  { value: "falcon3:7b" },
  { value: "qwen2.5-coder:7b" },
  { value: "qwen3-coder:480b-cloud" },
  { value: "stable-code:3b" },
];

export const THINKING_MODELS = [
  { value: "deepseek-v3.1:671b-cloud" },
  { value: "deepseek-r1:1.5b-qwen-distill-fp16" },
  { value: "gpt-oss:120b-cloud" },
  { value: "gpt-oss:20b-cloud" },
  { value: "qwen3-coder:480b-cloud" },
];
const ModelSelectionContext = createContext<ModelSelection | undefined>(undefined);

export function useModelSelection() {
  const context = useContext(ModelSelectionContext);
  if (!context) throw new Error("useModelSelection can only be used inside ModelSelectionProvider");
  return context;
}

export function ModelSelectionProvider({
  children,
  modelOptions,
}: {
  children: React.ReactNode;
  modelOptions: ModelOptions;
}) {
  const [selectedA, setSelectedA] = useState<string>(() => modelOptions[0]?.value);
  const [selectedB, setSelectedB] = useState<string>(() => modelOptions[1]?.value);
  const [chatStatus, setChatStatus] = useState<Record<PanelMode, PanelStatus>>({
    A: { isLoading: false, isThinking: false, hasHistory: false, error: null },
    B: { isLoading: false, isThinking: false, hasHistory: false, error: null },
  });
  return (
    <ModelSelectionContext.Provider
      value={{ selectedA, selectedB, setSelectedA, setSelectedB, chatStatus, setChatStatus }}
    >
      {children}
    </ModelSelectionContext.Provider>
  );
}

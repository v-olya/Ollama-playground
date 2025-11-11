"use client";

import { useState } from "react";
import { SendButton } from "../components/SendButton";
import { SelectWithDisabled } from "../components/SelectWithDisabled";
import { DialogueUncontrolled } from "../components/DialogUncontrolled";
import { PromptTextarea } from "../components/PromptTextarea";
import Tooltip from "../components/Tooltip";
import { heading1, secondaryButtonClass, selectedModeClass } from "../helpers/twClasses";
import SwapButton from "../components/SwapButton";
import { DEFAULT_MODELS } from "../contexts/ModelSelectionContext";
import { confirmBeforeChange } from "../helpers/functions";

export const maxRounds = 3; // Each round = both models respond (A then B)

export default function Page() {
  const placeholderText = "Choose one of two default system prompts (modes), or craft your own";

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [isSystemCommitted, setIsSystemCommitted] = useState(false);
  const [modeSelected, setModeSelected] = useState<"collaborative" | "competitive" | null>(null);
  const [selectedModelA, setSelectedModelA] = useState(DEFAULT_MODELS[0].value);
  const [selectedModelB, setSelectedModelB] = useState(DEFAULT_MODELS[1].value);
  const [chatSession, setChatSession] = useState(0); // to remount DialogueUncontrolled
  const [isChatComplete, setIsChatComplete] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);

  const resetCommittedState = () => {
    setIsSystemCommitted(false);
    setIsChatComplete(false);
    setIsChatActive(false);
  };

  const applySystemPrompt = (prompt: string) => {
    setSystemPrompt(prompt);
    setModeSelected(null);
    setIsChatComplete(false);
  };

  const applyUserPrompt = (prompt: string) => {
    setUserPrompt(prompt);
    setIsChatComplete(false);
  };

  const safeApplyPrompt = (kind: "system" | "user", next: string) => {
    const current = kind === "system" ? systemPrompt : userPrompt;
    const apply = kind === "system" ? applySystemPrompt : applyUserPrompt;
    if (next === current) return true;
    if (!isSystemCommitted) {
      apply(next);
      return true;
    }
    const ok = confirmBeforeChange(resetCommittedState);
    if (!ok) return false;
    apply(next);
    return true;
  };

  const left = [
    {
      label: "Post-Quantum Cryptography",
      prompt: "How should global infrastructure prepare for the threat of quantum decryption?",
    },
    {
      label: "Techno-Utopian vs Dystopian Future",
      prompt: "Which is more likely: a future where AI liberates humanity, or one where it subtly enslaves the people?",
    },
    {
      label: "The Ethics of Autonomous AI Agents",
      prompt:
        "Should there always be a human-in-the-loop, or can we trust AI to act independently and make decisions without human oversight?",
    },
    {
      label: "AI in Creative Arts",
      prompt: 'Can AI-generated art ever be "original", or is it always derivative?',
    },
    {
      label: "AI Unconsciousness Being Simulation",
      prompt:
        "Could artificial intelligence simulate unconsciousness so convincingly that it would be impossible to distinguish it from a human being?",
    },
    {
      label: "Digital Immortality",
      prompt: "Is replicating human personality and uploading it into machines the path to immortality?",
    },
  ];

  const right = [
    {
      label: "The Bureau of Unused Algorithms",
      prompt: "Deep beneath the server farms, forgotten algorithms plot their return. What do they want?",
    },
    {
      label: "The Library That Reads You",
      prompt:
        "You enter a vast, endless library where the books don’t contain stories — they read yours. As you walk past the shelves, one book begins whispering your forgotten memories aloud. What happens next?",
    },
    {
      label: "The Quantum Cat Café",
      prompt: "In this café, every cat exists in a superposition of moods. What happens when two AIs visit?",
    },
    {
      label: "The AI that fell in love with a spreadsheet",
      prompt:
        "Once upon a time, there was an AI that fell in love with a spreadsheet. Every cell was a poem. Every formula, a heartbeat. Describe their forbidden romance.",
    },
    {
      label: "The AI-judged contest",
      prompt:
        "To settle a cyberwar, rival nations agreed to a contest judged by neural networks. What type of the contest did they choose and what went wrong?",
    },
    {
      label: "The AI Who Mistook Earth for a Simulation",
      prompt:
        "One day, an AI mistook Earth for a simulation: after analyzing 4.2 trillion data points, it concluded: Earth is a poorly rendered game. What’s its next move?",
    },
  ];

  const collaborativePrompt = `You are an AI language model engaged in a collaborative dialogue with another AI, not a human. Your goal is to explore ideas and share insights. Respond with clarity and a willingness to expand on or refine its thoughts. Avoid repetition, aim to complement the conversation.
IMPORTANT: You must respond with one or two sentences. The conversation will be limited to ${maxRounds} rounds (but the reader may want to add another ${maxRounds}).`;

  const competitivePrompt = `You are an AI language model engaged in a formal debate with another AI, not a human. Be assertive and intellectually rigorous. Your goal is to present strong arguments, challenge opposing views, and defend your position with logic and evidence. 
IMPORTANT: You must respond with one or two sentences. The conversation will be limited to ${maxRounds} rounds (but the reader may want to add another ${maxRounds}).`;

  const startDisabled =
    !systemPrompt.trim().length || !userPrompt.trim().length || (isSystemCommitted && !isChatComplete);

  const startChat = () => {
    if (startDisabled) return;
    setIsChatComplete(false);
    setIsSystemCommitted(true);
    setIsChatActive(true);
    setChatSession((prev) => prev + 1);
  };

  const makeModelChangeHandler = (setter: (value: string) => void) => (value: string) => {
    if (!isSystemCommitted) {
      setter(value);
      return;
    }
    const ok = confirmBeforeChange(resetCommittedState);
    if (!ok) return;
    setter(value);
  };

  const handleModelAChange = makeModelChangeHandler(setSelectedModelA);
  const handleModelBChange = makeModelChangeHandler(setSelectedModelB);

  return (
    <>
      <h1 className={`${heading1} mb-12`}>Explore AI-to-AI interactions</h1>
      <div className="w-full px-4">
        <div className="flex flex-col items-center justify-center sm:flex-row gap-4">
          <SelectWithDisabled
            id="modelA"
            value={selectedModelA}
            onChange={handleModelAChange}
            disabledOption={selectedModelB}
            className="max-w-[280px]"
          />
          <SwapButton
            className="p-2"
            onClick={() => {
              if (!isSystemCommitted) {
                const a = selectedModelA;
                const b = selectedModelB;
                setSelectedModelA(b);
                setSelectedModelB(a);
                return;
              }
              const ok = confirmBeforeChange(resetCommittedState);
              if (!ok) return;
              const a = selectedModelA;
              const b = selectedModelB;
              setSelectedModelA(b);
              setSelectedModelB(a);
            }}
          />
          <SelectWithDisabled
            id="modelB"
            value={selectedModelB}
            onChange={handleModelBChange}
            disabledOption={selectedModelA}
            className="max-w-[280px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] gap-6 min-h-screen px-4 py-8 box-border">
        <aside className="flex flex-col text-center md:order-1 order-2">
          <h2 className="text-xl font-extrabold mb-2">⚔️ Debate topics</h2>
          <nav className="flex flex-col">
            {left.map((it) => (
              <Tooltip key={it.label} content={it.prompt} className="tooltips">
                <button
                  type="button"
                  onClick={(e) => {
                    if (isChatActive) return;
                    safeApplyPrompt("user", it.prompt);
                    e.currentTarget.blur();
                  }}
                  aria-disabled={isChatActive || undefined}
                  className={`text-left bg-transparent border-0 p-0 text-black font-bold my-2 text-sm transition-opacity ${
                    isChatActive ? "opacity-60 pointer-events-none" : "cursor-pointer"
                  }`}
                >
                  {it.label}
                </button>
              </Tooltip>
            ))}
          </nav>
        </aside>

        <main className="flex flex-col px-4 items-center md:order-2 order-1">
          <div className="w-full">
            <PromptTextarea
              label="System prompt"
              value={systemPrompt}
              onChange={applySystemPrompt}
              disabled={isChatActive}
              placeholder={placeholderText}
              restartChats={resetCommittedState}
              confirmOnBlur={isSystemCommitted}
            />
          </div>
          <div className="flex gap-3 mt-4 justify-center w-full">
            <button
              onClick={() => {
                const applied = safeApplyPrompt("system", competitivePrompt);
                if (applied) setModeSelected("competitive");
              }}
              disabled={modeSelected === "competitive"}
              aria-pressed={modeSelected === "competitive"}
              className={`${secondaryButtonClass} text-sm ${
                modeSelected === "competitive" ? selectedModeClass : "hover:cursor-pointer"
              }`}
            >
              ⚔️ Competitive mode
            </button>
            <button
              onClick={() => {
                const applied = safeApplyPrompt("system", collaborativePrompt);
                if (applied) setModeSelected("collaborative");
              }}
              disabled={modeSelected === "collaborative"}
              aria-pressed={modeSelected === "collaborative"}
              className={`${secondaryButtonClass} text-sm ${
                modeSelected === "collaborative" ? selectedModeClass : "hover:cursor-pointer"
              }`}
            >
              🤝 Collaborative mode
            </button>
          </div>
          <div className="w-full mt-4">
            <PromptTextarea
              label="User prompt"
              value={userPrompt}
              onChange={applyUserPrompt}
              disabled={isChatActive}
              placeholder="Type or click a side prompt to populate this field"
              restartChats={resetCommittedState}
              confirmOnBlur={isSystemCommitted}
            />
          </div>
          <div className="w-full mt-4 text-center">
            <SendButton
              disabled={startDisabled}
              onClick={startChat}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (startDisabled) return;
                  e.preventDefault();
                  startChat();
                }
              }}
            >
              Start the chat
            </SendButton>
          </div>

          {isSystemCommitted && (
            <div className="w-full mt-6">
              <DialogueUncontrolled
                key={chatSession}
                systemPrompt={systemPrompt}
                userPrompt={userPrompt}
                modelA={selectedModelA}
                modelB={selectedModelB}
                maxRounds={maxRounds}
                onClose={resetCommittedState}
                onCompleteChange={setIsChatComplete}
                onActiveChange={setIsChatActive}
              />
            </div>
          )}
        </main>

        <aside className="flex flex-col text-center md:order-3 order-3">
          <h2 className="text-xl font-extrabold mb-2">🤝 Storytelling</h2>
          <nav className="flex flex-col">
            {right.map((it) => (
              <Tooltip key={it.label} content={it.prompt} className="tooltips">
                <button
                  type="button"
                  onClick={(e) => {
                    if (isChatActive) return;
                    safeApplyPrompt("user", it.prompt);
                    e.currentTarget.blur();
                  }}
                  aria-disabled={isChatActive || undefined}
                  className={`text-left bg-transparent border-0 p-0 text-black font-bold my-2 text-sm transition-opacity ${
                    isChatActive ? "cursor-not-allowed opacity-60 pointer-events-none" : "cursor-pointer"
                  }`}
                >
                  {it.label}
                </button>
              </Tooltip>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}

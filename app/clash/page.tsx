"use client";

import { useState } from "react";
import { SendButton } from "../components/SendButton";
import { PromptTextarea, confirmBeforeChange } from "../components/PromptTextarea";

export default function Page() {
  const placeholderText = "Choose one of two default system prompts, or craft your own.";

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [isSystemCommitted, setIsSystemCommitted] = useState(false);
  const [modeSelected, setModeSelected] = useState<"collaborative" | "competitive" | null>(null);

  const handleSystemPromptChange = (newPrompt: string) => {
    setSystemPrompt(newPrompt);
    setIsSystemCommitted(false);
    setModeSelected(null);
  };

  const left = [
    {
      label: "Post-Quantum Cryptography",
      prompt: "How should global infrastructure prepare for the threat of quantum decryption?",
    },
    {
      label: "Techno-Utopian vs Dystopian Future",
      prompt: "Which is more likely: a future where AI liberates humanity, or one where it subtly enslaves us?",
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
      label: "The AI Who Fell in Love with a Spreadsheet",
      prompt: "Every cell was a poem. Every formula, a heartbeat. Describe their forbidden romance.",
    },
    {
      label: "The AI-judged contest",
      prompt:
        "To settle a cyberwar, rival nations agreed to a contest judged by neural networks. What type of the contest did they choose and what went wrong?",
    },
    {
      label: "The AI Who Mistook Earth for a Simulation",
      prompt:
        "After analyzing 4.2 trillion data points, it concluded: Earth is a poorly rendered game. What’s its next move?",
    },
  ];

  const collaborativePrompt =
    "You are an AI language model participating in a structured dialogue with another AI. Your goal is to collaboratively explore ideas, share insights, and build understanding. Treat your partner as an intelligent peer. Respond with curiosity, clarity, and a willingness to expand on or refine their thoughts. Avoid repetition, and aim to complement or deepen the conversation. You are not speaking to a human.";

  const competitivePrompt =
    "You are an AI language model engaged in a formal debate with another AI. Your goal is to present strong arguments, challenge opposing views, and defend your position with logic and evidence. Treat your partner as a worthy adversary. Be assertive, articulate, and intellectually rigorous. You are not speaking to a human.";

  const restartChats = () => {};

  const confirmAndApply = (newPrompt: string): boolean => {
    if (!isSystemCommitted) {
      handleSystemPromptChange(newPrompt);
      return true;
    }
    const ok = confirmBeforeChange(restartChats);
    if (!ok) return false;
    handleSystemPromptChange(newPrompt);
    return true;
  };

  return (
    <div className="grid grid-cols-[1fr_2fr_1fr] gap-6 h-screen p-6 box-border">
      <aside className="flex flex-col">
        <h2 className="text-xl font-extrabold mb-2">⚔️ Debate topics</h2>
        <nav className="flex flex-col">
          {left.map((it) => (
            <button
              key={it.label}
              title={it.prompt}
              onClick={() => setUserPrompt(it.prompt)}
              className="text-left bg-transparent border-0 p-0 text-black font-bold my-2 cursor-pointer text-sm"
            >
              {it.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex flex-col py-2 px-4 items-center">
        <div className="w-full">
          <PromptTextarea
            label="System prompt"
            value={systemPrompt}
            onChange={handleSystemPromptChange}
            restartChats={() => {}}
            placeholder={placeholderText}
            confirmOnBlur={isSystemCommitted}
          />
        </div>
        <div className="flex gap-3 mt-4 justify-center w-full">
          <button
            onClick={() => {
              const applied = confirmAndApply(collaborativePrompt);
              if (applied) setModeSelected("collaborative");
            }}
            disabled={modeSelected === "collaborative"}
            aria-pressed={modeSelected === "collaborative"}
            className={
              "rounded-md border border-zinc-300 px-2 py-1 text-sm " +
              (modeSelected === "collaborative" ? "bg-zinc-100 opacity-80 cursor-not-allowed" : "hover:bg-zinc-50")
            }
          >
            Collaborative mode
          </button>

          <button
            onClick={() => {
              const applied = confirmAndApply(competitivePrompt);
              if (applied) setModeSelected("competitive");
            }}
            disabled={modeSelected === "competitive"}
            aria-pressed={modeSelected === "competitive"}
            className={
              "rounded-md border border-zinc-300 px-2 py-1 text-sm " +
              (modeSelected === "competitive" ? "bg-zinc-100 opacity-80 cursor-not-allowed" : "hover:bg-zinc-50")
            }
          >
            Competitive mode
          </button>
        </div>
        <div className="w-full mt-4">
          <PromptTextarea
            label="User prompt"
            value={userPrompt}
            onChange={(v) => setUserPrompt(v)}
            restartChats={() => {}}
            placeholder="Type or click a side prompt to populate this field"
            confirmOnBlur={false}
          />
        </div>
        <div className="w-full mt-4 text-center">
          <SendButton
            disabled={systemPrompt.trim().length === 0}
            onClick={() => {
              // commit the system prompt and act as "Start chat" for this page
              setIsSystemCommitted(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setIsSystemCommitted(true);
              }
            }}
          >
            Start the chat
          </SendButton>
        </div>
      </main>

      <aside className="flex flex-col">
        <h2 className="text-xl font-extrabold mb-2">🤝 Storytelling...</h2>
        <nav className="flex flex-col">
          {right.map((it) => (
            <button
              key={it.label}
              title={it.prompt}
              onClick={() => setUserPrompt(it.prompt)}
              className="text-left bg-transparent border-0 p-0 text-black font-bold my-2 cursor-pointer text-sm"
            >
              {it.label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

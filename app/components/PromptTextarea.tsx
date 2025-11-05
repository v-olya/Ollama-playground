"use client";

import { useRef, type ChangeEvent } from "react";

interface PromptTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  restartChats: () => void;
  placeholder?: string;
  className?: string;
}

export default function PromptTextarea({
  label,
  value,
  onChange,
  restartChats,
  placeholder,
}: PromptTextareaProps) {
  const editingActive = useRef(false);

  const handleBeforeChange = () => {
    if (!editingActive.current) {
      const confirmed = window.confirm(
        "Are you sure you want to restart all the chats?"
      );
      if (!confirmed) return false;
      editingActive.current = true;
      restartChats();
    }
    return true;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const shouldProceed = handleBeforeChange();

    // Store the value that should be displayed in the ::after pseudo-element
    // (for textarea height to be unlimited)
    if (e.target.parentElement) {
      e.target.parentElement.dataset.clonedVal = !shouldProceed
        ? value
        : nextValue;
    }
    if (shouldProceed === false) {
      // Restore the displayed value
      e.target.value = value;
      return;
    }
    onChange(nextValue);
  };

  return (
    <label className="flex w-full flex-col gap-2">
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-right">
        {label}
      </div>
      <div
        className={`
        grid
        text-sm
        after:p-2
        [&>textarea]:text-inherit
        after:text-inherit
        [&>textarea]:resize-none
        [&>textarea]:overflow-hidden
        [&>textarea]:[grid-area:1/1/2/2]
        after:[grid-area:1/1/2/2]
        after:whitespace-pre-wrap
        after:invisible
        after:content-[attr(data-cloned-val)_'_']
        after:border
      `}
        data-cloned-val={value}
      >
        <textarea
          className="min-h-10 w-full rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent"
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={() => (editingActive.current = false)}
        />
      </div>
    </label>
  );
}

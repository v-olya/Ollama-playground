"use client";

import { FocusEvent, useState, type ChangeEvent } from "react";

interface PromptTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  restartChats: () => void;
  placeholder?: string;
  className?: string;
}

export function PromptTextarea({ label, value, onChange, restartChats, placeholder }: PromptTextareaProps) {
  const [initialValue, setInitialValue] = useState("");

  const handleBeforeChange = () => {
    const confirmed = window.confirm(
      "If you modify the prompt, the current chat will be restarted.\n Are you sure you want to restart?"
    );
    if (!confirmed) return false;
    restartChats();
    return true;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // Store the value that should be displayed in the ::after pseudo-element (for the textarea height to be unlimited)
    if (e.target.parentElement) {
      e.target.parentElement.dataset.clonedVal = e.target.value;
    }
  };
  const handleFocus = (e: FocusEvent) => {
    const textarea = e.target as HTMLTextAreaElement;
    setInitialValue(textarea.value);
  };
  const handleBlur = (e: FocusEvent) => {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea.value !== initialValue) {
      const shouldProceed = handleBeforeChange();
      if (shouldProceed === false) {
        // Restore the displayed value
        textarea.value = initialValue;
      } else {
        onChange(textarea.value);
      }
    }
  };

  return (
    <label className="flex w-full flex-col gap-2">
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-right">{label}</div>
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
          defaultValue={value}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
        />
      </div>
    </label>
  );
}

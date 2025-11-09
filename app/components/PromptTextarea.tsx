"use client";

import { FocusEvent, useRef, useEffect, type ChangeEvent } from "react";
import { confirmBeforeChange } from "../helpers/functions";

interface PromptTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  restartChats?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // When false, skip the before-change confirmation on blur
  confirmOnBlur?: boolean;
}

export function PromptTextarea({
  label,
  value,
  onChange,
  restartChats,
  disabled = false,
  placeholder,
  confirmOnBlur = true,
}: PromptTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dirtyCalledRef = useRef(false);
  const baseTextareaClass =
    "min-h-10 w-full rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-800 dark:bg-transparent";
  const textareaClass = disabled ? `${baseTextareaClass} cursor-not-allowed opacity-70` : baseTextareaClass;

  const handleBeforeChange = () => {
    if (confirmOnBlur === false) return true;
    if (!restartChats) return true;
    return confirmBeforeChange(restartChats);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    // Store the value that should be displayed in the ::after pseudo-element (for the textarea height to be unlimited)
    if (e.target.parentElement) {
      e.target.parentElement.dataset.clonedVal = e.target.value;
    }
    dirtyCalledRef.current = true;
  };

  // Keep the displayed textarea value in sync when `value` prop changes from parent.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.value = value;
      if (textarea.parentElement) {
        textarea.parentElement.dataset.clonedVal = value;
      }
      // Parent-controlled updates mean this was not a user edit — reset dirty flag
      dirtyCalledRef.current = false;
    }
  }, [value]);
  const handleBlur = (e: FocusEvent) => {
    if (disabled) return;
    const textarea = e.target as HTMLTextAreaElement;
    // If the user didn't interact (no onChange fired), skip confirmation.
    if (!dirtyCalledRef.current) return;

    const shouldProceed = handleBeforeChange();
    if (shouldProceed === false) {
      textarea.value = value;
      if (textarea.parentElement) textarea.parentElement.dataset.clonedVal = value;
      dirtyCalledRef.current = false;
    } else {
      // Commit the user's change to the parent and clear dirty flag
      onChange(textarea.value);
      dirtyCalledRef.current = false;
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
          ref={textareaRef}
          defaultValue={value}
          placeholder={placeholder}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : undefined}
          className={textareaClass}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
    </label>
  );
}

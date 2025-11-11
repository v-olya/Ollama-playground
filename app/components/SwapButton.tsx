"use client";

import React from "react";
import { secondaryButtonClass } from "../helpers/twClasses";

interface SwapButtonProps {
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function SwapButton({
  onClick,
  className = "",
  ariaLabel = "Swap models",
  title = "Swap models",
  disabled = false,
  children,
}: SwapButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${secondaryButtonClass} ${className}`}
    >
      {children ?? <b>⇄</b>}
    </button>
  );
}

export default SwapButton;

"use client";

import React from "react";

interface SendButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function SendButton({ children, className = "", type = "button", ...buttonProps }: SendButtonProps) {
  const base =
    "rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed";
  return (
    <button type={type} className={`${base} ${className}`} {...buttonProps}>
      {children}
    </button>
  );
}

"use client";

import React from "react";
import { primaryButtonBase } from "../helpers/twClasses";

interface SendButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function SendButton({ children, className = "", type = "button", ...buttonProps }: SendButtonProps) {
  const base = `${primaryButtonBase} bg-sky-600`;
  return (
    <button type={type} className={`${base} ${className}`} {...buttonProps}>
      {children}
    </button>
  );
}

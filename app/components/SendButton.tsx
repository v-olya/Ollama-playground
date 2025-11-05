"use client";

import React from "react";

interface SendButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export default function SendButton({
  children,
  className = "",
  ...rest
}: SendButtonProps) {
  const base =
    "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60";
  return (
    <button className={`${base} ${className}`} {...rest}>
      {children}
    </button>
  );
}

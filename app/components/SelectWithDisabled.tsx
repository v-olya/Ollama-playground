"use client";

import { DEFAULT_MODELS } from "../contexts/ModelSelectionContext";
import { formInput } from "../helpers/twClasses";

interface SelectWithDisabledProps {
  id: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledOption?: string;
  // optional list to render instead of the default DEFAULT_MODELS
  options?: Array<{ value: string }>;
  className?: string;
}

export function SelectWithDisabled({
  id,
  value,
  onChange,
  disabled = false,
  disabledOption,
  options,
  className,
}: SelectWithDisabledProps) {
  const opts = options ?? DEFAULT_MODELS;
  return (
    <select
      id={id}
      className={`${formInput} ${className ?? ""}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {opts.map((option) => {
        const optionValue = option.value;
        const isDisabled = disabledOption === optionValue;

        return (
          <option key={optionValue} value={optionValue} disabled={isDisabled}>
            {optionValue}
          </option>
        );
      })}
    </select>
  );
}

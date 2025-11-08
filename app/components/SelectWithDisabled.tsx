"use client";

import { MODEL_OPTIONS } from "../contexts/ModelSelectionContext";

interface SelectWithDisabledProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledOption?: string;
}

export function SelectWithDisabled({ id, value, onChange, disabled = false, disabledOption }: SelectWithDisabledProps) {
  return (
    <select
      id={id}
      className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-700 dark:bg-transparent"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {MODEL_OPTIONS.map((option) => {
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

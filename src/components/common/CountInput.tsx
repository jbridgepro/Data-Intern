/**
 * File: src/components/common/CountInput.tsx
 *
 * Shared count input for File Creation and Folder Creation.
 * Provides an intuitive number input with stepper buttons, clear labeling,
 * and validation (clamp on blur, 1–1000). Keeps typing responsive by not
 * forcing "1" when the user clears the field.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 1000;

export interface CountInputProps {
  /** Current count value (controlled). */
  value: number;
  /** Called with the new count when it changes (always a number in [min, max]). */
  onChange: (count: number) => void;
  /** Label above the input (e.g. "Number of folders"). */
  label: string;
  /** Optional short hint shown below the label (e.g. "1–1000"). */
  hint?: string;
  /** Minimum allowed value. Default 1. */
  min?: number;
  /** Maximum allowed value. Default 1000. */
  max?: number;
  /** Disable the input and stepper buttons. */
  disabled?: boolean;
  /** Additional class name for the root wrapper. */
  className?: string;
}

/**
 * Clamps a number to the given range. Returns min if value is NaN or below min.
 */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return Math.floor(value);
}

/**
 * CountInput – Front-end component.
 * Intuitive count field with +/- steppers, validation, and optional hint.
 */
export function CountInput({
  value,
  onChange,
  label,
  hint,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  disabled = false,
  className,
}: CountInputProps) {
  const [localInputValue, setLocalInputValue] = React.useState<string | null>(
    null,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  // When parent updates (e.g. preset applied), show the new value
  React.useEffect(() => {
    setLocalInputValue(null);
  }, [value]);

  const displayValue =
    localInputValue !== null ? localInputValue : String(value);

  const commitValue = React.useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10);
      const clamped = clamp(parsed, min, max);
      onChange(clamped);
      setLocalInputValue(null);
    },
    [onChange, min, max],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setLocalInputValue("");
      return;
    }
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      setLocalInputValue(raw);
      return;
    }
    const clamped = clamp(parsed, min, max);
    onChange(clamped);
    setLocalInputValue(null);
  };

  const handleBlur = () => {
    if (localInputValue === null) return;
    if (localInputValue.trim() === "") {
      onChange(min);
      setLocalInputValue(null);
      return;
    }
    commitValue(localInputValue);
  };

  const handleFocus = () => {
    setLocalInputValue(String(value));
  };

  const handleDecrement = () => {
    const next = Math.max(min, value - 1);
    onChange(next);
    setLocalInputValue(null);
  };

  const handleIncrement = () => {
    const next = Math.min(max, value + 1);
    onChange(next);
    setLocalInputValue(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        {hint != null && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-md"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          step={1}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="h-8 text-sm text-center tabular-nums"
          disabled={disabled}
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-md"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

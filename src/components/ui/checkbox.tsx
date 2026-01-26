import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Simple custom checkbox since we don't have radix-ui/react-checkbox in dependencies list
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className={cn(
            "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:text-primary-foreground",
            className
          )}
          ref={ref}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <Check className="pointer-events-none absolute left-0 top-0 hidden h-4 w-4 text-primary-foreground peer-checked:block" />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

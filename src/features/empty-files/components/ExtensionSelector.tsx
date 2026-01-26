import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface ExtensionSelectorProps {
  selectedExtensions: string[];
  onAdd: (ext: string) => void;
  onRemove: (ext: string) => void;
}

const COMMON_EXTENSIONS = [
  "txt", "md", "json", "csv", "log", 
  "sql", "js", "ts", "css", "html"
];

export const ExtensionSelector = ({
  selectedExtensions,
  onAdd,
  onRemove,
}: ExtensionSelectorProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleAdd = () => {
    if (inputValue.trim()) {
      // Normalize: remove leading dot, cleanup spaces
      const clean = inputValue.replace(/^\./, "").trim();
      if (clean) {
        onAdd(clean);
        setInputValue("");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Extensions
        </Label>
        <span className="text-xs text-muted-foreground">
          {selectedExtensions.length} selected
        </span>
      </div>

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {selectedExtensions.map((ext) => (
          <Badge
            key={ext}
            variant="secondary"
            className="pl-2 pr-1 py-1 flex items-center gap-1 group bg-primary/10 text-primary hover:bg-primary/20"
          >
            .{ext}
            <button
              onClick={() => onRemove(ext)}
              className="hover:bg-destructive/10 hover:text-destructive rounded-full p-0.5 transition-colors focus:outline-none"
              aria-label={`Remove .${ext} extension`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Input Group */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleAddKey}
            placeholder="Add extension (e.g. css)"
            className="h-8 text-sm pr-8"
          />
          <Plus className="absolute right-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="h-8"
        >
          Add
        </Button>
      </div>

      {/* Common Presets */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-2">Common:</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_EXTENSIONS.map((ext) => {
            const isSelected = selectedExtensions.includes(ext);
            return (
              <button
                key={ext}
                onClick={() => !isSelected && onAdd(ext)}
                disabled={isSelected}
                className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
                  isSelected
                    ? "bg-muted text-muted-foreground border-transparent opacity-50 cursor-default"
                    : "hover:bg-accent text-foreground border-border"
                }`}
              >
                .{ext}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

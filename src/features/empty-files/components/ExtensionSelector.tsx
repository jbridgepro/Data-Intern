
import { useState, useMemo, KeyboardEvent } from "react";
import { X, Plus, Search, ChevronRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ExtensionSelectorProps {
  selectedExtensions: string[];
  onAdd: (ext: string) => void;
  onRemove: (ext: string) => void;
}

const EXTENSION_CATEGORIES = {
  Web: ["html", "css", "js", "ts", "jsx", "tsx", "json", "xml", "svg", "wasm"],
  Data: ["csv", "sql", "log", "yaml", "toml", "ini", "env", "md", "txt"],
  Code: ["py", "java", "c", "cpp", "h", "rs", "go", "rb", "php", "sh", "bat"],
  Documents: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
  System: ["conf", "lock", "gitignore", "dockerfile"],
};

type Category = keyof typeof EXTENSION_CATEGORIES;
const CATEGORIES = Object.keys(EXTENSION_CATEGORIES) as Category[];

export const ExtensionSelector = ({
  selectedExtensions,
  onAdd,
  onRemove,
}: ExtensionSelectorProps) => {
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("Web");

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

  // Filter extensions based on search query
  const filteredExtensions = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase().trim();
    const allExts = Object.values(EXTENSION_CATEGORIES).flat();
    // Use Set to remove duplicates if any (though currently none)
    return Array.from(new Set(allExts)).filter(ext => 
      ext.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Extensions
        </Label>
        <span className="text-xs text-muted-foreground">
          {selectedExtensions.length} selected
        </span>
      </div>

      {/* Selected Tags */}
      <div className="min-h-[32px] p-1">
        {selectedExtensions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedExtensions.map((ext) => (
              <Badge
                key={ext}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1 group bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                onClick={() => onRemove(ext)}
              >
                .{ext}
                <div
                  className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                  aria-label={`Remove .${ext} extension`}
                >
                  <X className="h-3 w-3" />
                </div>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">
            No extensions selected. Add custom extensions or choose from the library below.
          </p>
        )}
      </div>

      {/* Custom Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleAddKey}
            placeholder="Add custom (e.g. myext)"
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

      <Separator />

      {/* Library Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground">
            Extension Library
          </Label>
        </div>

        {/* Search Library */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
            className="h-8 text-sm pl-8 bg-muted/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="border rounded-md bg-card/30 overflow-hidden flex flex-col h-[220px]">
          {searchQuery ? (
            // Search Results View
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredExtensions && filteredExtensions.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {filteredExtensions.map((ext) => {
                      const isSelected = selectedExtensions.includes(ext);
                      return (
                        <button
                          key={ext}
                          onClick={() => !isSelected ? onAdd(ext) : onRemove(ext)}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 text-xs rounded-md border transition-all text-left",
                            isSelected
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "hover:bg-accent hover:border-accent-foreground/20 border-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>.{ext}</span>
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <p className="text-xs">No matching extensions found.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            // Categorized View
            <div className="flex h-full">
              {/* Category Sidebar */}
              <div className="w-24 border-r bg-muted/10 shrink-0 overflow-y-auto">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[10px] font-medium transition-colors border-l-2 flex items-center justify-between group",
                      activeCategory === category
                        ? "bg-background border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {category}
                    {activeCategory === category && (
                      <ChevronRight className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Extension Grid */}
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-medium text-foreground mb-1">
                      {activeCategory}
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      Click to select
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {EXTENSION_CATEGORIES[activeCategory].map((ext) => {
                      const isSelected = selectedExtensions.includes(ext);
                      return (
                        <button
                          key={ext}
                          onClick={() => !isSelected ? onAdd(ext) : onRemove(ext)}
                          className={cn(
                            "flex items-center group justify-between px-2 py-1.5 text-xs rounded-md border transition-all text-left",
                            isSelected
                              ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                              : "bg-background hover:bg-accent hover:border-accent-foreground/20 border-border text-foreground hover:text-accent-foreground"
                          )}
                        >
                          <span className={cn(isSelected ? "font-medium" : "")}>
                            .{ext}
                          </span>
                          <div className={cn(
                            "transition-opacity duration-200",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                             {isSelected ? (
                               <Check className="h-3 w-3" />
                             ) : (
                               <Plus className="h-3 w-3 text-muted-foreground" />
                             )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

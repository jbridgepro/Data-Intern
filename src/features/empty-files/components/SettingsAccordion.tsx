import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";

interface SettingsAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const SettingsAccordion = ({
  title,
  children,
  defaultOpen = false,
}: SettingsAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors select-none">
          {title}
        </Label>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pl-5 border-l-2 ml-1.5 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

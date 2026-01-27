import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AgentSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const AgentSearch = ({ value, onChange }: AgentSearchProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search Agents..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 bg-background border-slate-200 dark:border-slate-800"
      />
    </div>
  );
};

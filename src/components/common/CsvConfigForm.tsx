/**
 * File: src/components/common/CsvConfigForm.tsx
 * 
 * Shared component for configuring CSV-based generation.
 * Handles file import, parsing, delimiter detection, and column mapping.
 */

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { 
    Upload, 
    FileSpreadsheet, 
    ArrowUp, 
    ArrowDown, 
    Plus,
    Trash
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { motion } from "framer-motion";

export interface CsvConfig {
    csvRows: Record<string, string>[];
    csvHeaders: string[];
    csvDelimiter: string;
    csvColumnOrder: string[];
    csvColumnConfig: Record<string, {
        enabled: boolean;
        prefix: string;
        suffix: string;
    }>;
}

interface CsvConfigFormProps<T extends CsvConfig> {
    config: T;
    setConfig: (config: T) => void;
    isCreating: boolean;
}

export const CsvConfigForm = <T extends CsvConfig>({ config, setConfig, isCreating }: CsvConfigFormProps<T>) => {
    const [fileName, setFileName] = useState<string>("");
    const [selectedColumnToAdd, setSelectedColumnToAdd] = useState<string>("");
    const [rawContent, setRawContent] = useState<string>("");
    const [inputDelimiter, setInputDelimiter] = useState<string>(",");
    
    // Simple CSV Parser
    const parseCSV = (text: string, delimiter: string = ","): Record<string, string>[] => {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];

        // Helper to split line respecting quotes
        const splitLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === delimiter && !inQuotes) {
                    result.push(current.replace(/^"|"$/g, '').trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            result.push(current.replace(/^"|"$/g, '').trim());
            return result;
        };

        const headers = splitLine(lines[0]);
        const rows = lines.slice(1);

        return rows.map(line => {
            const values = splitLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
                row[h] = values[i] || "";
            });
            return row;
        });
    };

    const detectDelimiter = (line: string): string => {
        const delimiters = [",", ";", "\t", "|"];
        let bestDelimiter = ",";
        let maxCount = 0;

        for (const d of delimiters) {
            const count = line.split(d).length - 1;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = d;
            }
        }
        return bestDelimiter;
    };

    const processContent = (content: string, delimiter: string) => {
         const data = parseCSV(content, delimiter);
         if (data.length > 0) {
             const headers = Object.keys(data[0]);
             
             setConfig({
                 ...config,
                 csvRows: data,
                 csvHeaders: headers,
                 csvDelimiter: config.csvDelimiter || "-", 
                 csvColumnOrder: [], 
                 csvColumnConfig: {}
             });
         }
    };

    const handleImportCsv = async () => {
        try {
            const selected = await open({
                filters: [{ name: "CSV", extensions: ["csv", "txt"] }],
                multiple: false,
            });

            if (selected && typeof selected === "string") {
                setFileName(selected.split(/[\\/]/).pop() || "Selected File");
                const content = await readTextFile(selected);
                setRawContent(content);
                
                const firstLine = content.split(/\r?\n/)[0] || "";
                const detected = detectDelimiter(firstLine);
                setInputDelimiter(detected);
                
                processContent(content, detected);
            }
        } catch (err) {
            console.error("Failed to read CSV", err);
        }
    };

    const handleDelimiterChange = (val: string) => {
        setInputDelimiter(val);
        if (rawContent) {
            processContent(rawContent, val);
        }
    };

    const addColumn = () => {
        if (!selectedColumnToAdd || config.csvColumnOrder?.includes(selectedColumnToAdd)) return;

        const newOrder = [...(config.csvColumnOrder || []), selectedColumnToAdd];
        const currentConfig = config.csvColumnConfig?.[selectedColumnToAdd] || { enabled: true, prefix: "", suffix: "" };
        
        setConfig({
            ...config,
            csvColumnOrder: newOrder,
            csvColumnConfig: {
                ...config.csvColumnConfig,
                [selectedColumnToAdd]: { ...currentConfig, enabled: true }
            }
        });
        setSelectedColumnToAdd("");
    };

    const removeColumn = (colId: string) => {
        const newOrder = (config.csvColumnOrder || []).filter(c => c !== colId);
        setConfig({
            ...config,
            csvColumnOrder: newOrder
        });
    };

    const updateColumnConfig = (colId: string, field: "prefix" | "suffix", value: string) => {
        const currentConfig = config.csvColumnConfig?.[colId] || { enabled: true, prefix: "", suffix: "" };
        setConfig({
            ...config,
            csvColumnConfig: {
                ...config.csvColumnConfig,
                [colId]: { ...currentConfig, [field]: value }
            }
        });
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const order = [...(config.csvColumnOrder || [])];
        if (direction === 'up' && index > 0) {
            [order[index], order[index - 1]] = [order[index - 1], order[index]];
        } else if (direction === 'down' && index < order.length - 1) {
            [order[index], order[index + 1]] = [order[index + 1], order[index]];
        }
        setConfig({ ...config, csvColumnOrder: order });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* File Import */}
            <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CSV Source
                </Label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-muted/50 rounded-md border border-dashed border-muted-foreground/25 flex items-center justify-center p-4 text-sm text-muted-foreground">
                        {fileName ? (
                            <div className="flex items-center gap-2 text-foreground font-medium">
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                {fileName}
                                <span className="text-xs text-muted-foreground font-normal ml-2">
                                    ({config.csvRows?.length || 0} rows)
                                </span>
                            </div>
                        ) : (
                            "No CSV file loaded"
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="secondary"
                            className="h-full flex-1"
                            onClick={handleImportCsv}
                            disabled={isCreating}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Load CSV
                        </Button>
                         {fileName && (
                            <Select value={inputDelimiter} onValueChange={handleDelimiterChange} disabled={isCreating}>
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                    <SelectValue placeholder="Delimiter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value=",">Comma (,)</SelectItem>
                                    <SelectItem value=";">Semicolon (;)</SelectItem>
                                    <SelectItem value={"\t"}>Tab (\t)</SelectItem>
                                    <SelectItem value="|">Pipe (|)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            {config.csvRows && config.csvRows.length > 0 && (
                <>
                     <Separator />
                     
                     {/* Column Configuration */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 flex-1">
                                <Select value={selectedColumnToAdd} onValueChange={setSelectedColumnToAdd} disabled={isCreating}>
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                        <SelectValue placeholder="Select column..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(config.csvHeaders || []).filter(h => !config.csvColumnOrder?.includes(h)).map(h => (
                                            <SelectItem key={h} value={h} className="text-xs">
                                                {h}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={addColumn}
                                    disabled={!selectedColumnToAdd || isCreating}
                                    className="h-8"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                </Button>
                             </div>
                            
                            {/* Global Separator Config */}
                            <div className="flex items-center gap-2">
                                <Label className="text-xs">Join with</Label>
                                <Input 
                                    className="w-12 h-6 text-center text-xs p-0"
                                    value={config.csvDelimiter}
                                    onChange={(e) => setConfig({...config, csvDelimiter: e.target.value})}
                                    placeholder="-"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>

                        <ScrollArea className="h-[250px] rounded-md border bg-card">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground">&nbsp;</th>
                                        <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground">#</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Column</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[80px]">Prefix</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[80px]">Suffix</th>
                                        <th className="h-10 px-2 text-center align-middle font-medium text-muted-foreground w-[60px]">&nbsp;</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {config.csvColumnOrder?.map((colId, index) => {
                                        const colConfig = config.csvColumnConfig?.[colId] || { enabled: true, prefix: "", suffix: "" };
                                        return (
                                            <tr 
                                                key={colId} 
                                                className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${!colConfig.enabled ? "opacity-50" : ""}`}
                                            >
                                                <td className="p-2 text-center align-middle">
                                                   {/* Handle */}
                                                </td>
                                                <td className="p-2 text-center align-middle text-xs text-muted-foreground">
                                                    {index + 1}
                                                </td>
                                                <td className="p-2 align-middle font-medium text-sm">
                                                    {colId}
                                                </td>
                                                <td className="p-2 align-middle">
                                                    <Input 
                                                        className="h-7 text-xs" 
                                                        placeholder="pre_" 
                                                        value={colConfig.prefix}
                                                        onChange={(e) => updateColumnConfig(colId, "prefix", e.target.value)}
                                                        disabled={!colConfig.enabled || isCreating}
                                                    />
                                                </td>
                                                <td className="p-2 align-middle">
                                                     <Input 
                                                        className="h-7 text-xs" 
                                                        placeholder="_suf"
                                                        value={colConfig.suffix}
                                                        onChange={(e) => updateColumnConfig(colId, "suffix", e.target.value)}
                                                        disabled={!colConfig.enabled || isCreating}
                                                    />
                                                </td>
                                                <td className="p-2 align-middle text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <button 
                                                            onClick={() => moveColumn(index, 'up')}
                                                            disabled={index === 0 || isCreating}
                                                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => moveColumn(index, 'down')}
                                                            disabled={index === (config.csvColumnOrder?.length || 0) - 1 || isCreating}
                                                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => removeColumn(colId)}
                                                            disabled={isCreating}
                                                            className="text-muted-foreground hover:text-red-500 disabled:opacity-30 mt-1"
                                                            title="Remove column"
                                                        >
                                                            <Trash className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </ScrollArea>
                        <p className="text-[10px] text-muted-foreground">
                            Order determines how columns are combined in the folder name.
                        </p>
                     </div>
                </>
            )}
        </motion.div>
    );
};


import React, { useState, useEffect } from "react";
import { Calculator, ArrowRightLeft, Copy, Trash2 } from "lucide-react";

type UnitCategory = "length" | "weight" | "temperature" | "digital";

interface Unit {
  id: string;
  name: string;
  factor: number; // Conversion factor to base unit
  offset?: number; // For temperature
}

const UNITS: Record<UnitCategory, Unit[]> = {
  length: [
    { id: "m", name: "Meters", factor: 1 },
    { id: "km", name: "Kilometers", factor: 1000 },
    { id: "cm", name: "Centimeters", factor: 0.01 },
    { id: "mm", name: "Millimeters", factor: 0.001 },
    { id: "mi", name: "Miles", factor: 1609.34 },
    { id: "yd", name: "Yards", factor: 0.9144 },
    { id: "ft", name: "Feet", factor: 0.3048 },
    { id: "in", name: "Inches", factor: 0.0254 },
  ],
  weight: [
    { id: "kg", name: "Kilograms", factor: 1 },
    { id: "g", name: "Grams", factor: 0.001 },
    { id: "mg", name: "Milligrams", factor: 0.000001 },
    { id: "lb", name: "Pounds", factor: 0.453592 },
    { id: "oz", name: "Ounces", factor: 0.0283495 },
  ],
  temperature: [
    { id: "c", name: "Celsius", factor: 1 },
    { id: "f", name: "Fahrenheit", factor: 1 }, // Special handling
    { id: "k", name: "Kelvin", factor: 1 }, // Special handling
  ],
  digital: [
    { id: "b", name: "Bytes", factor: 1 },
    { id: "kb", name: "Kilobytes", factor: 1024 },
    { id: "mb", name: "Megabytes", factor: 1024 * 1024 },
    { id: "gb", name: "Gigabytes", factor: 1024 * 1024 * 1024 },
    { id: "tb", name: "Terabytes", factor: 1024 * 1024 * 1024 * 1024 },
  ],
};

export const UnitConverter: React.FC = () => {
  const [category, setCategory] = useState<UnitCategory>("length");
  const [fromUnit, setFromUnit] = useState<string>(UNITS.length[0].id);
  const [toUnit, setToUnit] = useState<string>(UNITS.length[1].id);
  const [amount, setAmount] = useState<string>("1");
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    // Reset units when category changes
    const defaultUnits = UNITS[category];
    if (!defaultUnits.find(u => u.id === fromUnit)) setFromUnit(defaultUnits[0].id);
    if (!defaultUnits.find(u => u.id === toUnit)) setToUnit(defaultUnits[1]?.id || defaultUnits[0].id);
  }, [category]);

  useEffect(() => {
    convert();
  }, [amount, fromUnit, toUnit, category]);

  const convert = () => {
    const val = parseFloat(amount);
    if (isNaN(val)) {
      setResult("");
      return;
    }

    if (category === "temperature") {
      let resultVal = val;
      // Convert to Celsius first
      if (fromUnit === "f") resultVal = (val - 32) * (5 / 9);
      if (fromUnit === "k") resultVal = val - 273.15;
      
      // Convert from Celsius to target
      if (toUnit === "f") resultVal = resultVal * (9 / 5) + 32;
      if (toUnit === "k") resultVal = resultVal + 273.15;
      
      setResult(resultVal.toFixed(2));
      return;
    }

    const from = UNITS[category].find((u) => u.id === fromUnit)?.factor || 1;
    const to = UNITS[category].find((u) => u.id === toUnit)?.factor || 1;
    const res = (val * from) / to;
    
    // Format nicely
    setResult(res < 0.0001 ? res.toExponential(4) : res.toLocaleString(undefined, { maximumFractionDigits: 6 }));
  };

  const swapUnits = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Unit Converter
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Convert between common units of measurement
          </p>
        </div>
      </div>

      <div className="max-w-xl self-center w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        
        {/* Category Selector */}
        <div className="mb-6 flex overflow-x-auto pb-2 scrollbar-hide gap-2">
          {(Object.keys(UNITS) as UnitCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                category === cat
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
            {/* From */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">From</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                {UNITS[category].map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-lg font-medium focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            {/* Swap */}
            <button
              onClick={swapUnits}
              className="mb-3 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <ArrowRightLeft className="h-5 w-5" />
            </button>

            {/* To */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">To</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                {UNITS[category].map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="flex h-[46px] w-full items-center rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-lg font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300">
                {result || "---"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

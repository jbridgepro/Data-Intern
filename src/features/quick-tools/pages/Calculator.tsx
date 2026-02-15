import React, { useEffect, useState } from 'react';
import {
  Calculator,
  ShieldAlert,
  Zap,
  DollarSign,
  FlaskConical,
  Hammer,
  Copy,
  Clock,
  Check,
  ChevronRight,
  TrendingDown,
  Activity,
  Ruler,
  Thermometer,
  Building,
} from 'lucide-react';

// --- Types ---

type CalculatorMode =
  | 'standard'
  | 'insurance'
  | 'engineering'
  | 'finance'
  | 'science'
  | 'trades'
  | 'property';

interface ModeConfig {
  id: CalculatorMode;
  name: string;
  icon: React.ElementType;
  description: string;
}

const useLocalStorageState = <T,>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore write errors (private mode, quota, etc.)
    }
  }, [key, value]);

  return [value, setValue] as const;
};

const MODES: ModeConfig[] = [
  { id: 'standard', name: 'Standard', icon: Calculator, description: 'Basic arithmetic' },
  { id: 'insurance', name: 'Insurance', icon: ShieldAlert, description: 'Risk & Premiums' },
  { id: 'engineering', name: 'Engineering', icon: Zap, description: 'Electrical & Physics' },
  { id: 'finance', name: 'Finance', icon: DollarSign, description: 'Loans & TVM' },
  { id: 'science', name: 'Science', icon: FlaskConical, description: 'Lab & Healthcare' },
  { id: 'trades', name: 'Skilled Trades', icon: Hammer, description: 'Construction & HVAC' },
  { id: 'property', name: 'Property Assessment', icon: Building, description: 'Tax & Valuation' },
];

// --- Components ---

const StandardCalculator = () => {
  const [input, setInput] = useState('0');
  const [tokens, setTokens] = useState<string[]>([]);
  const [lastExpression, setLastExpression] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [history, setHistory] = useState<Array<{ expression: string; result: string; time: number }>>([]);
  const [copyStatus, setCopyStatus] = useState('');

  const isOperator = (val: string) => ['+', '-', '*', '/'].includes(val);

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return 'Error';
    const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
    return parseFloat(rounded.toFixed(10)).toString();
  };

  const evaluateTokens = (expression: string[]) => {
    const values: number[] = [];
    const ops: string[] = [];
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

    const applyOp = () => {
      const op = ops.pop();
      const b = values.pop();
      const a = values.pop();
      if (op === undefined || a === undefined || b === undefined) {
        throw new Error('Invalid expression');
      }
      if (op === '/' && b === 0) throw new Error('Divide by zero');
      switch (op) {
        case '+':
          values.push(a + b);
          break;
        case '-':
          values.push(a - b);
          break;
        case '*':
          values.push(a * b);
          break;
        case '/':
          values.push(a / b);
          break;
        default:
          throw new Error('Unknown operator');
      }
    };

    expression.forEach((token) => {
      if (isOperator(token)) {
        while (ops.length && precedence[ops[ops.length - 1]] >= precedence[token]) {
          applyOp();
        }
        ops.push(token);
      } else {
        const value = Number(token);
        if (Number.isNaN(value)) throw new Error('Invalid number');
        values.push(value);
      }
    });

    while (ops.length) applyOp();
    if (values.length !== 1) throw new Error('Invalid expression');
    return values[0];
  };

  const pushHistory = (expression: string, result: string) => {
    if (!expression) return;
    setHistory((prev) => {
      const next = [{ expression, result, time: Date.now() }, ...prev];
      return next.slice(0, 8);
    });
  };

  const copyToClipboard = async (value: string) => {
    if (!value || value === 'Error') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('Copied');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopyStatus('Copied');
      } catch {
        setCopyStatus('Copy failed');
      }
    }
  };

  const commitNumber = (nextInput: string) => {
    setInput(nextInput);
    setJustEvaluated(false);
  };

  const handleDigit = (digit: string) => {
    if (input === 'Error') {
      commitNumber(digit);
      return;
    }
    if (justEvaluated) {
      commitNumber(digit === '.' ? '0.' : digit);
      return;
    }
    if (digit === '.' && input.includes('.')) return;
    if (input === '0' && digit !== '.') {
      setInput(digit);
    } else {
      setInput(input + digit);
    }
  };

  const handleOperator = (op: string) => {
    if (input === 'Error') return;
    const updatedTokens = [...tokens];
    if (updatedTokens.length > 0 && isOperator(updatedTokens[updatedTokens.length - 1])) {
      updatedTokens[updatedTokens.length - 1] = op;
    } else {
      updatedTokens.push(input, op);
    }
    setTokens(updatedTokens);
    setInput('0');
    setJustEvaluated(false);
  };

  const handleEquals = () => {
    if (input === 'Error') return;
    const expressionTokens = [...tokens];
    if (input !== '') expressionTokens.push(input);
    if (expressionTokens.length === 0) return;
    if (isOperator(expressionTokens[expressionTokens.length - 1])) {
      expressionTokens.pop();
    }
    try {
      const result = evaluateTokens(expressionTokens);
      const formatted = formatNumber(result);
      setInput(formatted);
      setTokens([]);
      setLastExpression(expressionTokens.join(' '));
      pushHistory(expressionTokens.join(' '), formatted);
      setJustEvaluated(true);
    } catch {
      setInput('Error');
      setTokens([]);
      setJustEvaluated(true);
    }
  };

  const handleClear = () => {
    setInput('0');
    setTokens([]);
    setLastExpression('');
    setJustEvaluated(false);
  };

  const handleDelete = () => {
    if (justEvaluated) {
      handleClear();
      return;
    }
    if (input.length <= 1 || (input.length === 2 && input.startsWith('-'))) {
      setInput('0');
      return;
    }
    setInput(input.slice(0, -1));
  };

  const handleToggleSign = () => {
    if (input === '0' || input === 'Error') return;
    setInput(input.startsWith('-') ? input.slice(1) : `-${input}`);
  };

  const handlePercent = () => {
    if (input === 'Error') return;
    const value = Number(input);
    if (Number.isNaN(value)) return;
    setInput(formatNumber(value / 100));
    setJustEvaluated(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key >= '0' && key <= '9') {
        event.preventDefault();
        handleDigit(key);
        return;
      }
      if (key === '.') {
        event.preventDefault();
        handleDigit('.');
        return;
      }
      if (['+', '-', '*', '/'].includes(key)) {
        event.preventDefault();
        handleOperator(key);
        return;
      }
      if (key === 'Enter' || key === '=') {
        event.preventDefault();
        handleEquals();
        return;
      }
      if (key === 'Backspace') {
        event.preventDefault();
        handleDelete();
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        handleClear();
        return;
      }
      if (key === '%') {
        event.preventDefault();
        handlePercent();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [input, tokens, justEvaluated]);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = window.setTimeout(() => setCopyStatus(''), 1500);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const btnBase =
    'h-12 rounded-xl text-lg font-medium transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
  const numBtn =
    `${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;
  const opBtn =
    `${btnBase} bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60`;
  const actionBtn =
    `${btnBase} bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`;

  const previewExpression = tokens.join(' ');
  const displayExpression = previewExpression || lastExpression || ' ';

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-slate-900 text-white text-right p-4 rounded-2xl mb-4 font-mono overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400 min-h-[1rem]">
          <span className="truncate">{displayExpression}</span>
          <button
            type="button"
            onClick={() => copyToClipboard(input)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            {copyStatus === 'Copied' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copyStatus || 'Copy'}
          </button>
        </div>
        <div className="text-3xl sm:text-4xl tracking-tight">{input}</div>
        <div className="text-[11px] text-slate-500 mt-2">Keyboard: 0-9, +, -, *, /, %, Enter</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'AC', type: 'action', onClick: handleClear },
          { label: 'DEL', type: 'action', onClick: handleDelete },
          { label: '%', type: 'action', onClick: handlePercent },
          { label: '/', type: 'op', onClick: () => handleOperator('/') },
          { label: '7', type: 'num', onClick: () => handleDigit('7') },
          { label: '8', type: 'num', onClick: () => handleDigit('8') },
          { label: '9', type: 'num', onClick: () => handleDigit('9') },
          { label: '*', type: 'op', onClick: () => handleOperator('*') },
          { label: '4', type: 'num', onClick: () => handleDigit('4') },
          { label: '5', type: 'num', onClick: () => handleDigit('5') },
          { label: '6', type: 'num', onClick: () => handleDigit('6') },
          { label: '-', type: 'op', onClick: () => handleOperator('-') },
          { label: '1', type: 'num', onClick: () => handleDigit('1') },
          { label: '2', type: 'num', onClick: () => handleDigit('2') },
          { label: '3', type: 'num', onClick: () => handleDigit('3') },
          { label: '+', type: 'op', onClick: () => handleOperator('+') },
          { label: '+/-', type: 'action', onClick: handleToggleSign },
          { label: '0', type: 'num', onClick: () => handleDigit('0') },
          { label: '.', type: 'num', onClick: () => handleDigit('.') },
          { label: '=', type: 'equal', onClick: handleEquals },
        ].map((button) => (
          <button
            key={button.label}
            onClick={button.onClick}
            className={
              button.type === 'equal'
                ? `${btnBase} bg-indigo-600 text-white hover:bg-indigo-700`
                : button.type === 'op'
                  ? opBtn
                  : button.type === 'action'
                    ? actionBtn
                    : numBtn
            }
          >
            {button.label}
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Clock className="h-3.5 w-3.5" />
              History
            </div>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.time}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setInput(item.result);
                    setTokens([]);
                    setJustEvaluated(true);
                  }}
                  className="flex-1 text-left text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 truncate"
                  title={`${item.expression} = ${item.result}`}
                >
                  {item.expression} = <span className="font-semibold">{item.result}</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyToClipboard(item.result);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Copy result"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <details className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Details & Assumptions
        </summary>
        <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div>Supports operator precedence: multiplication/division before addition/subtraction.</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Percent converts the current value to a fraction (value ÷ 100).</li>
            <li>Results are rounded to 10 decimal places for display.</li>
            <li>History stores the last 8 calculations on this device.</li>
          </ul>
        </div>
      </details>
    </div>
  );
};

const InsuranceCalculator = () => {
  const [incurredLosses, setIncurredLosses] = useState<number>(0);
  const [adjustmentExpenses, setAdjustmentExpenses] = useState<number>(0);
  const [earnedPremium, setEarnedPremium] = useState<number>(0);
  const [lossRatio, setLossRatio] = useState<string>('---');
  const [autoCalc, setAutoCalc] = useLocalStorageState('quick-tools-calculator:autoCalc:insurance', true);
  const [error, setError] = useState('');

  const calculate = () => {
    if (earnedPremium <= 0) {
      setLossRatio('---');
      setError('Earned premium must be greater than 0.');
      return;
    }
    if (incurredLosses < 0 || adjustmentExpenses < 0) {
      setLossRatio('---');
      setError('Values cannot be negative.');
      return;
    }
    const ratio = ((incurredLosses + adjustmentExpenses) / earnedPremium) * 100;
    setLossRatio(ratio.toFixed(2) + '%');
    setError('');
  };

  useEffect(() => {
    if (autoCalc) calculate();
  }, [autoCalc, incurredLosses, adjustmentExpenses, earnedPremium]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Loss Ratio Calculator</h3>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Incurred Losses (USD)</label>
          <input type="number" className="w-full p-2 border rounded" value={incurredLosses} onChange={e => setIncurredLosses(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Loss Adjustment Expenses (USD)</label>
          <input type="number" className="w-full p-2 border rounded" value={adjustmentExpenses} onChange={e => setAdjustmentExpenses(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Earned Premium (USD)</label>
          <input type="number" className="w-full p-2 border rounded" value={earnedPremium} onChange={e => setEarnedPremium(Number(e.target.value))} />
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={autoCalc} onChange={(e) => setAutoCalc(e.target.checked)} />
            Auto-calc
          </label>
          <button onClick={calculate} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">Calculate Ratio</button>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded text-center">
          <div className="text-sm text-slate-500">Loss Ratio</div>
          <div className="text-2xl font-bold">{lossRatio}</div>
        </div>
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Details & Assumptions
        </summary>
        <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div>Formula: Loss Ratio = (Incurred Losses + Loss Adjustment Expenses) ÷ Earned Premium × 100.</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>All inputs are in USD.</li>
            <li>Earned premium must be greater than 0.</li>
          </ul>
        </div>
      </details>
    </div>
  );
};

const EngineeringCalculator = () => {
  const [voltage, setVoltage] = useState<string>('');
  const [current, setCurrent] = useState<string>('');
  const [resistance, setResistance] = useState<string>('');
  const [power, setPower] = useState<string>('');
  const [autoCalc, setAutoCalc] = useLocalStorageState('quick-tools-calculator:autoCalc:engineering', true);
  const [ohmsError, setOhmsError] = useState('');

  const calculateOhms = () => {
    const v = parseFloat(voltage);
    const i = parseFloat(current);
    const r = parseFloat(resistance);
    const provided = [v, i, r].filter((val) => !Number.isNaN(val)).length;

    if (provided < 2 || provided === 3) {
      setOhmsError('');
      return;
    }

    if (!Number.isNaN(v) && !Number.isNaN(i)) {
      if (i === 0) {
        setOhmsError('Current cannot be 0 when solving for resistance.');
        return;
      }
      setResistance((v / i).toFixed(2));
      setOhmsError('');
    } else if (!Number.isNaN(v) && !Number.isNaN(r)) {
      if (r === 0) {
        setOhmsError('Resistance cannot be 0 when solving for current.');
        return;
      }
      setCurrent((v / r).toFixed(2));
      setOhmsError('');
    } else if (!Number.isNaN(i) && !Number.isNaN(r)) {
      setVoltage((i * r).toFixed(2));
      setOhmsError('');
    }
  };
  
   const calculatePower = () => {
    const v = parseFloat(voltage);
    const i = parseFloat(current);
    if (!isNaN(v) && !isNaN(i)) setPower((v * i).toFixed(2));
  };

  useEffect(() => {
    if (!autoCalc) return;
    calculateOhms();
    calculatePower();
  }, [autoCalc, voltage, current, resistance]);


  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Zap className="h-5 w-5" /> Ohm's Law (V = IR)</h3>
        <p className="text-sm text-slate-500 mb-4">Enter any two values to calculate the third.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Voltage (V)</label>
            <input type="number" className="w-full p-2 border rounded" placeholder="Volts" value={voltage} onChange={e => setVoltage(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Current (A)</label>
            <input type="number" className="w-full p-2 border rounded" placeholder="Amps" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Resistance (Ohm)</label>
            <input type="number" className="w-full p-2 border rounded" placeholder="Ohms" value={resistance} onChange={e => setResistance(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
             <label className="inline-flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={autoCalc} onChange={(e) => setAutoCalc(e.target.checked)} />
              Auto-calc
            </label>
             <button onClick={calculateOhms} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 min-w-[140px]">Calculate Ohm's</button>
             <button onClick={calculatePower} className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 min-w-[140px]">Calculate Power (P=VI)</button>
        </div>
         {ohmsError && <div className="mt-2 text-sm text-rose-600">{ohmsError}</div>}
         {power && <div className="mt-4 p-2 bg-purple-50 dark:bg-purple-900/20 text-center rounded text-purple-700 dark:text-purple-300">Power: <strong>{power} W</strong></div>}
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Details & Assumptions
        </summary>
        <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div>Formulas: V = I × R, P = V × I.</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Provide exactly two values to solve for the third.</li>
            <li>Units: volts (V), amps (A), ohms (R), watts (W).</li>
          </ul>
        </div>
      </details>
    </div>
  );
};

const FinanceCalculator = () => {
  const [principal, setPrincipal] = useState<number>(250000);
  const [rate, setRate] = useState<number>(5.5);
  const [years, setYears] = useState<number>(30);
  const [payment, setPayment] = useState<string>('---');
  const [autoCalc, setAutoCalc] = useLocalStorageState('quick-tools-calculator:autoCalc:finance', true);
  const [error, setError] = useState('');

  const calculateLoan = () => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const p = principal;
    
    if (p <= 0 || n <= 0 || rate < 0) {
        setPayment('---');
        setError('Enter a positive loan amount and term. Rate cannot be negative.');
        return;
    }

    if (r === 0) {
        setPayment((p / n).toFixed(2));
        setError('');
        return;
    }

    const m = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    setPayment(m.toFixed(2));
    setError('');
  };

  useEffect(() => {
    if (autoCalc) calculateLoan();
  }, [autoCalc, principal, rate, years]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5" /> Loan Repayment</h3>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Loan Amount (USD)</label>
          <input type="number" className="w-full p-2 border rounded" value={principal} onChange={e => setPrincipal(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Interest Rate (APR %)</label>
            <input type="number" step="0.1" className="w-full p-2 border rounded" value={rate} onChange={e => setRate(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Term (Years)</label>
            <input type="number" className="w-full p-2 border rounded" value={years} onChange={e => setYears(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={autoCalc} onChange={(e) => setAutoCalc(e.target.checked)} />
            Auto-calc
          </label>
          <button onClick={calculateLoan} className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700">Calculate Payment</button>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded text-center border border-green-100 dark:border-green-800">
          <div className="text-sm text-green-800 dark:text-green-300">Monthly Payment</div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-400">${payment}</div>
        </div>
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Details & Assumptions
        </summary>
        <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div>Formula: monthly payment for a fixed-rate amortized loan.</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>APR is divided by 12 to get the monthly rate.</li>
            <li>Term is in years; payments are monthly.</li>
            <li>Assumes payments occur at the end of each period.</li>
          </ul>
        </div>
      </details>
    </div>
  );
};

const ScienceCalculator = () => {
  const [weight, setWeight] = useState<number>(70);
  const [dosage, setDosage] = useState<number>(5);
  const [totalDose, setTotalDose] = useState<string>('---');
  const [autoDose, setAutoDose] = useLocalStorageState('quick-tools-calculator:autoCalc:science:dosage', true);
  const [doseError, setDoseError] = useState('');

  const [c1, setC1] = useState<number>(0);
  const [v1, setV1] = useState<number>(0);
  const [c2, setC2] = useState<number>(0);
  const [v2, setV2] = useState<number>(0);
  const [autoDilution, setAutoDilution] = useLocalStorageState('quick-tools-calculator:autoCalc:science:dilution', false);
  const [dilutionError, setDilutionError] = useState('');

  const calculateDosage = () => {
    if (weight <= 0 || dosage <= 0) {
      setDoseError('Weight and dosage must be greater than 0.');
      setTotalDose('---');
      return;
    }
    setTotalDose((weight * dosage).toFixed(1) + ' mg');
    setDoseError('');
  };

  const calculateDilution = () => {
      // C1V1 = C2V2
      // Calculate missing value
      const values = [c1, v1, c2, v2].filter((val) => val > 0);
      if (values.length < 3) {
        setDilutionError('Provide three values to solve for the fourth.');
        return;
      }
      if (values.length === 4) {
        setDilutionError(autoDilution ? '' : 'Clear one field to calculate it.');
        return;
      }

      if (c1 && v1 && c2 && !v2) {
        setV2((c1 * v1) / c2);
        setDilutionError('');
      } else if (c1 && v1 && !c2 && v2) {
        setC2((c1 * v1) / v2);
        setDilutionError('');
      } else if (c1 && !v1 && c2 && v2) {
        setV1((c2 * v2) / c1);
        setDilutionError('');
      } else if (!c1 && v1 && c2 && v2) {
        setC1((c2 * v2) / v1);
        setDilutionError('');
      }
  };

  useEffect(() => {
    if (autoDose) calculateDosage();
  }, [autoDose, weight, dosage]);

  useEffect(() => {
    if (autoDilution) calculateDilution();
  }, [autoDilution, c1, v1, c2, v2]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Activity className="h-5 w-5" /> Medication Dosage</h3>
        <div className="flex gap-4 items-end">
             <div className="flex-1">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Weight (kg)</label>
                <input type="number" className="w-full p-2 border rounded" value={weight} onChange={e => setWeight(Number(e.target.value))} />
            </div>
             <div className="flex-1">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Dosage (mg per kg)</label>
                <input type="number" className="w-full p-2 border rounded" value={dosage} onChange={e => setDosage(Number(e.target.value))} />
            </div>
            <button onClick={calculateDosage} className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 h-[42px]">Calc</button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={autoDose} onChange={(e) => setAutoDose(e.target.checked)} />
            Auto-calc
          </label>
          <div className="text-right font-bold text-teal-600">Total: {totalDose}</div>
        </div>
        {doseError && <div className="mt-1 text-sm text-rose-600">{doseError}</div>}
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><FlaskConical className="h-5 w-5" /> Dilution (C1V1 = C2V2)</h3>
        <p className="text-sm text-slate-500 mb-4">Leave one field empty to calculate it.</p>
        <div className="grid grid-cols-2 gap-4">
             <div><label className="text-xs">C1 (Initial concentration)</label><input type="number" className="w-full p-2 border rounded" value={c1 || ''} onChange={e => setC1(Number(e.target.value))} /></div>
             <div><label className="text-xs">V1 (Initial volume)</label><input type="number" className="w-full p-2 border rounded" value={v1 || ''} onChange={e => setV1(Number(e.target.value))} /></div>
             <div><label className="text-xs">C2 (Final concentration)</label><input type="number" className="w-full p-2 border rounded" value={c2 || ''} onChange={e => setC2(Number(e.target.value))} /></div>
             <div><label className="text-xs">V2 (Final volume)</label><input type="number" className="w-full p-2 border rounded" value={v2 || ''} onChange={e => setV2(Number(e.target.value))} /></div>
        </div>
         <div className="mt-4 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={autoDilution} onChange={(e) => setAutoDilution(e.target.checked)} />
            Auto-calc
          </label>
          <button onClick={calculateDilution} className="bg-slate-600 text-white py-2 px-4 rounded hover:bg-slate-700">Calculate Missing Value</button>
         </div>
         {dilutionError && <div className="mt-2 text-sm text-rose-600">{dilutionError}</div>}
      </div>
      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Details & Assumptions
        </summary>
        <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <div>Formulas: Total dose = weight × dosage. Dilution uses C1V1 = C2V2.</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Dosage assumes kg and mg/kg inputs.</li>
            <li>Dilution requires three positive values and solves for the fourth.</li>
            <li>Units must be consistent within each calculation.</li>
          </ul>
        </div>
      </details>
    </div>
  );
};

const TradesCalculator = () => {
    const [sideA, setSideA] = useState<number>(0);
    const [sideB, setSideB] = useState<number>(0);
    const [sideC, setSideC] = useState<number>(0); // Hypotenuse

    const [sqFootage, setSqFootage] = useState<number>(0);
    const [btu, setBtu] = useState<number>(0);
    const [autoCalcTriangle, setAutoCalcTriangle] = useLocalStorageState('quick-tools-calculator:autoCalc:trades:triangle', true);
    const [autoCalcBtu, setAutoCalcBtu] = useLocalStorageState('quick-tools-calculator:autoCalc:trades:btu', false);
    const [triangleError, setTriangleError] = useState('');

    const calcPythagoras = () => {
        const provided = [sideA, sideB, sideC].filter((val) => val > 0).length;
        if (provided < 2 || provided === 3) {
            setTriangleError('');
            return;
        }
        if (sideA > 0 && sideB > 0 && !sideC) {
            setSideC(Math.sqrt(sideA * sideA + sideB * sideB));
            setTriangleError('');
        } else if (sideA > 0 && sideC > 0 && !sideB) {
            if (sideC <= sideA) {
                setTriangleError('Hypotenuse must be longer than side A.');
                return;
            }
            setSideB(Math.sqrt(sideC * sideC - sideA * sideA));
            setTriangleError('');
        } else if (sideB > 0 && sideC > 0 && !sideA) {
            if (sideC <= sideB) {
                setTriangleError('Hypotenuse must be longer than side B.');
                return;
            }
            setSideA(Math.sqrt(sideC * sideC - sideB * sideB));
            setTriangleError('');
        }
    };

    const calcBtu = () => {
        // Rough estimate: 20 BTU per sq ft for average climate/insulation
        if (sqFootage <= 0) {
            setBtu(0);
            return;
        }
        setBtu(sqFootage * 20);
    };

    useEffect(() => {
        if (autoCalcTriangle) calcPythagoras();
    }, [autoCalcTriangle, sideA, sideB, sideC]);

    useEffect(() => {
        if (autoCalcBtu) calcBtu();
    }, [autoCalcBtu, sqFootage]);

    return (
        <div className="space-y-8">
            <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Ruler className="h-5 w-5" /> Right Triangle (a² + b² = c²)</h3>
                 <div className="flex gap-2 items-center">
                    <input placeholder="a (ft)" type="number" className="w-24 p-2 border rounded" value={sideA || ''} onChange={e => setSideA(Number(e.target.value))} />
                    <span>² +</span>
                    <input placeholder="b (ft)" type="number" className="w-24 p-2 border rounded" value={sideB || ''} onChange={e => setSideB(Number(e.target.value))} />
                    <span>² =</span>
                    <input placeholder="c (ft)" type="number" className="w-24 p-2 border rounded bg-slate-50" value={sideC ? sideC.toFixed(2) : ''} onChange={e => setSideC(Number(e.target.value))} />
                    <span>²</span>
                 </div>
                 <div className="mt-2 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={autoCalcTriangle} onChange={(e) => setAutoCalcTriangle(e.target.checked)} />
                        Auto-calc
                    </label>
                    <button onClick={calcPythagoras} className="bg-orange-600 text-white px-4 py-1 rounded text-sm">Calculate Missing</button>
                 </div>
                 {triangleError && <div className="mt-2 text-sm text-rose-600">{triangleError}</div>}
            </div>

            <div className="border-t pt-6">
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Thermometer className="h-5 w-5" /> HVAC Heat Load Est.</h3>
                 <div className="flex gap-4">
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500">Square Footage (sq ft)</label>
                        <input type="number" className="w-full p-2 border rounded" value={sqFootage || ''} onChange={e => setSqFootage(Number(e.target.value))} />
                     </div>
                     <div className="flex items-end">
                        <button onClick={calcBtu} className="bg-sky-600 text-white px-4 py-2 rounded h-[42px]">Estimate BTU</button>
                     </div>
                 </div>
                 <div className="mt-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={autoCalcBtu} onChange={(e) => setAutoCalcBtu(e.target.checked)} />
                        Auto-calc
                    </label>
                 </div>
                 {btu > 0 && <div className="mt-2 text-sky-700 font-bold">Recommended: {btu.toLocaleString()} BTU</div>}
            </div>

        <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Details & Assumptions
            </summary>
            <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div>Formulas: a² + b² = c², BTU estimate = square feet × 20.</div>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Triangle uses feet (ft) for consistency.</li>
                    <li>HVAC estimate assumes average climate and insulation.</li>
                    <li>BTU output is a rough guideline, not a load calc.</li>
                </ul>
            </div>
        </details>
    </div>
    );
};

const PropertyAssessmentCalculator = () => {
    // Tax Estimator State
    const [marketValue, setMarketValue] = useState<number>(300000);
    const [assessmentRatio, setAssessmentRatio] = useState<number>(100);
    const [exemption, setExemption] = useState<number>(0);
    const [millageRate, setMillageRate] = useState<number>(25);
    const [assessedValue, setAssessedValue] = useState<number>(0);
    const [estimatedTax, setEstimatedTax] = useState<number>(0);
    const [autoTax, setAutoTax] = useLocalStorageState('quick-tools-calculator:autoCalc:property:tax', true);
    const [taxError, setTaxError] = useState('');

    // Cap Rate State
    const [noi, setNoi] = useState<number>(50000);
    const [propertyValue, setPropertyValue] = useState<number>(800000);
    const [capRate, setCapRate] = useState<string>('---');
    const [autoCap, setAutoCap] = useLocalStorageState('quick-tools-calculator:autoCalc:property:cap', true);
    const [capError, setCapError] = useState('');

    const calculateTax = () => {
        if (marketValue <= 0 || assessmentRatio < 0 || millageRate < 0 || exemption < 0) {
            setTaxError('Values must be zero or greater. Market value must be positive.');
            setAssessedValue(0);
            setEstimatedTax(0);
            return;
        }
        const assessed = marketValue * (assessmentRatio / 100);
        const taxable = Math.max(0, assessed - exemption);
        const tax = taxable * (millageRate / 1000);
        
        setAssessedValue(assessed);
        setEstimatedTax(tax);
        setTaxError('');
    };

    const calculateCapRate = () => {
        if (propertyValue <= 0) {
            setCapRate('---');
            setCapError('Property value must be greater than 0.');
            return;
        }
        const rate = (noi / propertyValue) * 100;
        setCapRate(rate.toFixed(2) + '%');
        setCapError('');
    };

    useEffect(() => {
        if (autoTax) calculateTax();
    }, [autoTax, marketValue, assessmentRatio, exemption, millageRate]);

    useEffect(() => {
        if (autoCap) calculateCapRate();
    }, [autoCap, noi, propertyValue]);

    return (
        <div className="space-y-8">
            {/* Tax Estimator */}
            <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Building className="h-5 w-5" /> Tax Assessment Estimator</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Market Value (USD)</label>
                        <input type="number" className="w-full p-2 border rounded" value={marketValue} onChange={e => setMarketValue(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assessment Ratio (%)</label>
                        <input type="number" className="w-full p-2 border rounded" value={assessmentRatio} onChange={e => setAssessmentRatio(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exemptions (USD)</label>
                        <input type="number" className="w-full p-2 border rounded" value={exemption} onChange={e => setExemption(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Millage Rate (per $1,000)</label>
                        <input type="number" className="w-full p-2 border rounded" value={millageRate} onChange={e => setMillageRate(Number(e.target.value))} />
                    </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={autoTax} onChange={(e) => setAutoTax(e.target.checked)} />
                        Auto-calc
                    </label>
                    <button onClick={calculateTax} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">Calculate Tax</button>
                </div>
                {taxError && <div className="mb-3 text-sm text-rose-600">{taxError}</div>}
                
                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <div>
                        <div className="text-xs text-slate-500">Assessed Value</div>
                        <div className="text-lg font-bold">${assessedValue.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Estimated Annual Tax</div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">${estimatedTax.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Cap Rate Calculator */}
            <div className="border-t pt-6">
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Activity className="h-5 w-5" /> Commercial Cap Rate</h3>
                 <div className="grid grid-cols-2 gap-4 mb-4">
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Net Operating Income (USD/yr)</label>
                        <input type="number" className="w-full p-2 border rounded" value={noi} onChange={e => setNoi(Number(e.target.value))} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Property Value (USD)</label>
                        <input type="number" className="w-full p-2 border rounded" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} />
                     </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={autoCap} onChange={(e) => setAutoCap(e.target.checked)} />
                        Auto-calc
                    </label>
                    <button onClick={calculateCapRate} className="bg-emerald-600 text-white px-4 py-2 rounded">Calculate Cap Rate</button>
                 </div>
                 {capError && <div className="mt-2 text-sm text-rose-600">{capError}</div>}
                 {capRate !== '---' && <div className="mt-4 inline-block ml-4 text-xl font-bold text-emerald-700 dark:text-emerald-400">Cap Rate: {capRate}</div>}
            </div>

        <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Details & Assumptions
            </summary>
            <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div>Formulas: Assessed = Market Value × Assessment Ratio. Taxable = max(0, assessed − exemptions). Tax = taxable × (millage ÷ 1000). Cap Rate = NOI ÷ Property Value × 100.</div>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Millage rate is per $1,000 of taxable value.</li>
                    <li>NOI is annual; cap rate is annualized.</li>
                </ul>
            </div>
        </details>
    </div>
    );
};

// --- Main Layout ---

export const CalculatorTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<CalculatorMode>('standard');

  return (
    <div className="flex h-full flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            Pro Calc
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeMode === mode.id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${activeMode === mode.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div className="flex-1 text-left">
                  <div>{mode.name}</div>
                  <div className="text-[10px] opacity-70 font-normal">{mode.description}</div>
                </div>
                {activeMode === mode.id && <ChevronRight className="h-4 w-4 opacity-50" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col">
          <div className="border-b border-slate-100 dark:border-slate-800 p-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {MODES.find(m => m.id === activeMode)?.name} Calculator
            </h1>
            <p className="text-slate-500 text-sm">
                {MODES.find(m => m.id === activeMode)?.description}
            </p>
          </div>
          
          <div className="p-8 flex-1">
            {activeMode === 'standard' && <StandardCalculator />}
            {activeMode === 'insurance' && <InsuranceCalculator />}
            {activeMode === 'engineering' && <EngineeringCalculator />}
            {activeMode === 'finance' && <FinanceCalculator />}
            {activeMode === 'science' && <ScienceCalculator />}
            {activeMode === 'trades' && <TradesCalculator />}
            {activeMode === 'property' && <PropertyAssessmentCalculator />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorTool;

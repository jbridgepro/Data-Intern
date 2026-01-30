import React, { useState } from 'react';
import {
  Calculator,
  ShieldAlert,
  Zap,
  DollarSign,
  FlaskConical,
  Hammer,
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
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handlePress = (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setEquation('');
    } else if (val === '=') {
      try {
        // eslint-disable-next-line
        setDisplay(eval(equation).toString());
        setEquation('');
      } catch {
        setDisplay('Error');
      }
    } else if (['+', '-', '*', '/'].includes(val)) {
      setEquation(display + val);
      setDisplay('0');
    } else {
      setDisplay(display === '0' ? val : display + val);
      setEquation(equation + val);
    }
  };

  const btnClass = "h-12 rounded-lg bg-slate-100 text-lg font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all";
  const opClass = "h-12 rounded-lg bg-indigo-100 text-lg font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 active:scale-95 transition-all";

  return (
    <div className="max-w-xs mx-auto">
      <div className="bg-slate-900 text-white text-right p-4 rounded-xl mb-4 text-3xl font-mono overflow-hidden">
        {display}
        <div className="text-xs text-slate-400 min-h-[1rem]">{equation}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '/'].map((b) => (
          <button key={b} onClick={() => handlePress(b)} className={Number(b) ? btnClass : opClass}>{b}</button>
        ))}
        {['4', '5', '6', '*'].map((b) => (
          <button key={b} onClick={() => handlePress(b)} className={Number(b) ? btnClass : opClass}>{b}</button>
        ))}
        {['1', '2', '3', '-'].map((b) => (
          <button key={b} onClick={() => handlePress(b)} className={Number(b) ? btnClass : opClass}>{b}</button>
        ))}
        {['C', '0', '=', '+'].map((b) => (
          <button key={b} onClick={() => handlePress(b)} className={b === '=' ? "col-span-1 bg-indigo-600 text-white hover:bg-indigo-700" : (Number(b) || b === '0') ? btnClass : opClass}>{b}</button>
        ))}
      </div>
    </div>
  );
};

const InsuranceCalculator = () => {
  const [incurredLosses, setIncurredLosses] = useState<number>(0);
  const [adjustmentExpenses, setAdjustmentExpenses] = useState<number>(0);
  const [earnedPremium, setEarnedPremium] = useState<number>(0);
  const [lossRatio, setLossRatio] = useState<string>('---');

  const calculate = () => {
    if (earnedPremium === 0) return;
    const ratio = ((incurredLosses + adjustmentExpenses) / earnedPremium) * 100;
    setLossRatio(ratio.toFixed(2) + '%');
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Loss Ratio Calculator</h3>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Incurred Losses ($)</label>
          <input type="number" className="w-full p-2 border rounded" value={incurredLosses} onChange={e => setIncurredLosses(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Loss Adjustment Expenses ($)</label>
          <input type="number" className="w-full p-2 border rounded" value={adjustmentExpenses} onChange={e => setAdjustmentExpenses(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Earned Premium ($)</label>
          <input type="number" className="w-full p-2 border rounded" value={earnedPremium} onChange={e => setEarnedPremium(Number(e.target.value))} />
        </div>
        <button onClick={calculate} className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Calculate Ratio</button>
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded text-center">
          <div className="text-sm text-slate-500">Loss Ratio</div>
          <div className="text-2xl font-bold">{lossRatio}</div>
        </div>
      </div>
    </div>
  );
};

const EngineeringCalculator = () => {
  const [voltage, setVoltage] = useState<string>('');
  const [current, setCurrent] = useState<string>('');
  const [resistance, setResistance] = useState<string>('');
  const [power, setPower] = useState<string>('');

  const calculateOhms = () => {
    const v = parseFloat(voltage);
    const i = parseFloat(current);
    const r = parseFloat(resistance);

    if (!isNaN(v) && !isNaN(i)) setResistance((v / i).toFixed(2));
    else if (!isNaN(v) && !isNaN(r)) setCurrent((v / r).toFixed(2));
    else if (!isNaN(i) && !isNaN(r)) setVoltage((i * r).toFixed(2));
  };
  
   const calculatePower = () => {
    const v = parseFloat(voltage);
    const i = parseFloat(current);
    if (!isNaN(v) && !isNaN(i)) setPower((v * i).toFixed(2));
  };


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
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Current (I)</label>
            <input type="number" className="w-full p-2 border rounded" placeholder="Amps" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Resistance (R)</label>
            <input type="number" className="w-full p-2 border rounded" placeholder="Ohms" value={resistance} onChange={e => setResistance(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
             <button onClick={calculateOhms} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">Calculate Ohm's</button>
             <button onClick={calculatePower} className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700">Calculate Power (P=VI)</button>
        </div>
         {power && <div className="mt-4 p-2 bg-purple-50 dark:bg-purple-900/20 text-center rounded text-purple-700 dark:text-purple-300">Power: <strong>{power} W</strong></div>}
      </div>
    </div>
  );
};

const FinanceCalculator = () => {
  const [principal, setPrincipal] = useState<number>(250000);
  const [rate, setRate] = useState<number>(5.5);
  const [years, setYears] = useState<number>(30);
  const [payment, setPayment] = useState<string>('---');

  const calculateLoan = () => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const p = principal;
    
    if (r === 0) {
        setPayment((p / n).toFixed(2));
        return;
    }

    const m = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    setPayment(m.toFixed(2));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5" /> Loan Repayment</h3>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Loan Amount ($)</label>
          <input type="number" className="w-full p-2 border rounded" value={principal} onChange={e => setPrincipal(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
            <input type="number" step="0.1" className="w-full p-2 border rounded" value={rate} onChange={e => setRate(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Term (Years)</label>
            <input type="number" className="w-full p-2 border rounded" value={years} onChange={e => setYears(Number(e.target.value))} />
          </div>
        </div>
        <button onClick={calculateLoan} className="bg-green-600 text-white py-2 rounded hover:bg-green-700">Calculate Payment</button>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded text-center border border-green-100 dark:border-green-800">
          <div className="text-sm text-green-800 dark:text-green-300">Monthly Payment</div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-400">${payment}</div>
        </div>
      </div>
    </div>
  );
};

const ScienceCalculator = () => {
  const [weight, setWeight] = useState<number>(70);
  const [dosage, setDosage] = useState<number>(5);
  const [totalDose, setTotalDose] = useState<string>('---');

  const [c1, setC1] = useState<number>(0);
  const [v1, setV1] = useState<number>(0);
  const [c2, setC2] = useState<number>(0);
  const [v2, setV2] = useState<number>(0);

  const calculateDosage = () => {
    setTotalDose((weight * dosage).toFixed(1) + ' mg');
  };

  const calculateDilution = () => {
      // C1V1 = C2V2
      // Calculate missing value
      if (c1 && v1 && c2 && !v2) setV2((c1 * v1) / c2);
      else if (c1 && v1 && !c2 && v2) setC2((c1 * v1) / v2);
      else if (c1 && !v1 && c2 && v2) setV1((c2 * v2) / c1);
      else if (!c1 && v1 && c2 && v2) setC1((c2 * v2) / v1);
  };

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
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Dosage (mg/kg)</label>
                <input type="number" className="w-full p-2 border rounded" value={dosage} onChange={e => setDosage(Number(e.target.value))} />
            </div>
            <button onClick={calculateDosage} className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 h-[42px]">Calc</button>
        </div>
        <div className="mt-2 text-right font-bold text-teal-600">Total: {totalDose}</div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><FlaskConical className="h-5 w-5" /> Dilution (C1V1 = C2V2)</h3>
        <p className="text-sm text-slate-500 mb-4">Leave one field empty to calculate it.</p>
        <div className="grid grid-cols-2 gap-4">
             <div><label className="text-xs">C1 (Initial Conc)</label><input type="number" className="w-full p-2 border rounded" value={c1 || ''} onChange={e => setC1(Number(e.target.value))} /></div>
             <div><label className="text-xs">V1 (Initial Vol)</label><input type="number" className="w-full p-2 border rounded" value={v1 || ''} onChange={e => setV1(Number(e.target.value))} /></div>
             <div><label className="text-xs">C2 (Final Conc)</label><input type="number" className="w-full p-2 border rounded" value={c2 || ''} onChange={e => setC2(Number(e.target.value))} /></div>
             <div><label className="text-xs">V2 (Final Vol)</label><input type="number" className="w-full p-2 border rounded" value={v2 || ''} onChange={e => setV2(Number(e.target.value))} /></div>
        </div>
         <button onClick={calculateDilution} className="mt-4 w-full bg-slate-600 text-white py-2 rounded hover:bg-slate-700">Calculate Missing Value</button>
      </div>
    </div>
  );
};

const TradesCalculator = () => {
    const [sideA, setSideA] = useState<number>(0);
    const [sideB, setSideB] = useState<number>(0);
    const [sideC, setSideC] = useState<number>(0); // Hypotenuse

    const [sqFootage, setSqFootage] = useState<number>(0);
    const [btu, setBtu] = useState<number>(0);

    const calcPythagoras = () => {
        if (sideA && sideB && !sideC) setSideC(Math.sqrt(sideA*sideA + sideB*sideB));
        else if (sideA && sideC && !sideB) setSideB(Math.sqrt(sideC*sideC - sideA*sideA));
        else if (sideB && sideC && !sideA) setSideA(Math.sqrt(sideC*sideC - sideB*sideB));
    };

    const calcBtu = () => {
        // Rough estimate: 20 BTU per sq ft for average climate/insulation
        setBtu(sqFootage * 20);
    };

    return (
        <div className="space-y-8">
            <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Ruler className="h-5 w-5" /> Right Triangle (a² + b² = c²)</h3>
                 <div className="flex gap-2 items-center">
                    <input placeholder="a" type="number" className="w-20 p-2 border rounded" value={sideA || ''} onChange={e => setSideA(Number(e.target.value))} />
                    <span>² +</span>
                    <input placeholder="b" type="number" className="w-20 p-2 border rounded" value={sideB || ''} onChange={e => setSideB(Number(e.target.value))} />
                    <span>² =</span>
                    <input placeholder="c" type="number" className="w-20 p-2 border rounded bg-slate-50" value={sideC ? sideC.toFixed(2) : ''} onChange={e => setSideC(Number(e.target.value))} />
                    <span>²</span>
                 </div>
                 <button onClick={calcPythagoras} className="mt-2 bg-orange-600 text-white px-4 py-1 rounded text-sm">Calculate Missing</button>
            </div>

            <div className="border-t pt-6">
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Thermometer className="h-5 w-5" /> HVAC Heat Load Est.</h3>
                 <div className="flex gap-4">
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500">Square Footage</label>
                        <input type="number" className="w-full p-2 border rounded" value={sqFootage || ''} onChange={e => setSqFootage(Number(e.target.value))} />
                     </div>
                     <div className="flex items-end">
                        <button onClick={calcBtu} className="bg-sky-600 text-white px-4 py-2 rounded h-[42px]">Estimate BTU</button>
                     </div>
                 </div>
                 {btu > 0 && <div className="mt-2 text-sky-700 font-bold">Recommended: {btu.toLocaleString()} BTU</div>}
            </div>
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

    // Cap Rate State
    const [noi, setNoi] = useState<number>(50000);
    const [propertyValue, setPropertyValue] = useState<number>(800000);
    const [capRate, setCapRate] = useState<string>('---');

    const calculateTax = () => {
        const assessed = marketValue * (assessmentRatio / 100);
        const taxable = Math.max(0, assessed - exemption);
        const tax = taxable * (millageRate / 1000);
        
        setAssessedValue(assessed);
        setEstimatedTax(tax);
    };

    const calculateCapRate = () => {
        if (propertyValue === 0) return;
        const rate = (noi / propertyValue) * 100;
        setCapRate(rate.toFixed(2) + '%');
    };

    return (
        <div className="space-y-8">
            {/* Tax Estimator */}
            <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Building className="h-5 w-5" /> Tax Assessment Estimator</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Market Value ($)</label>
                        <input type="number" className="w-full p-2 border rounded" value={marketValue} onChange={e => setMarketValue(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assessment Ratio (%)</label>
                        <input type="number" className="w-full p-2 border rounded" value={assessmentRatio} onChange={e => setAssessmentRatio(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exemptions ($)</label>
                        <input type="number" className="w-full p-2 border rounded" value={exemption} onChange={e => setExemption(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Millage Rate</label>
                        <input type="number" className="w-full p-2 border rounded" value={millageRate} onChange={e => setMillageRate(Number(e.target.value))} />
                    </div>
                </div>
                <button onClick={calculateTax} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-4">Calculate Tax</button>
                
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
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Net Operating Income (NOI)</label>
                        <input type="number" className="w-full p-2 border rounded" value={noi} onChange={e => setNoi(Number(e.target.value))} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Property Value</label>
                        <input type="number" className="w-full p-2 border rounded" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} />
                     </div>
                 </div>
                 <button onClick={calculateCapRate} className="bg-emerald-600 text-white px-4 py-2 rounded">Calculate Cap Rate</button>
                 {capRate !== '---' && <div className="mt-4 inline-block ml-4 text-xl font-bold text-emerald-700 dark:text-emerald-400">Cap Rate: {capRate}</div>}
            </div>
        </div>
    );
};

// --- Main Layout ---

export const CalculatorTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<CalculatorMode>('standard');

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col">
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
      <div className="flex-1 p-8 overflow-y-auto">
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

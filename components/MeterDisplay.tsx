import React from 'react';
import { MultimeterReading, ConnectionStatus, TroubleshootingPreset } from '../types';

interface MeterDisplayProps {
  reading: MultimeterReading | null;
  status: ConnectionStatus;
  selectedPreset: TroubleshootingPreset | null;
}

export const MeterDisplay: React.FC<MeterDisplayProps> = ({ reading, status, selectedPreset }) => {
  // Placeholder visuals for disconnected state
  if (status !== ConnectionStatus.CONNECTED || !reading) {
    return (
      <div className="w-full h-64 bg-slate-900 rounded-xl border-2 border-slate-700 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.3)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/20 to-transparent pointer-events-none" />
        <h2 className="text-slate-500 text-2xl font-mono font-bold tracking-widest mb-2">--.--</h2>
        <span className="text-slate-600 uppercase text-xs tracking-[0.2em]">Waiting for Signal</span>
        
        {status === ConnectionStatus.CONNECTING && (
            <div className="mt-4 flex gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce delay-200" />
            </div>
        )}
      </div>
    );
  }

  // Handle Invalid/Syncing State
  const isInvalid = !reading.isValid;
  
  if (isInvalid) {
    return (
        <div className="w-full h-64 bg-slate-950 rounded-xl border-2 border-slate-800 flex flex-col items-center justify-center relative overflow-hidden p-6 shadow-inner">
             <div className="flex flex-col items-center animate-pulse">
                <h2 className="text-slate-600 text-4xl font-mono font-bold tracking-widest mb-2">SYNCING</h2>
                <span className="text-slate-700 uppercase text-xs tracking-[0.2em]">Device Connected</span>
             </div>
             
             {/* Raw Data Debug */}
             <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1">
                 <p className="text-slate-600 text-xs uppercase font-mono">Protocol: {reading.rawHex?.includes('ALT') ? 'ZOYI-ALT' : 'OWON-B35'}</p>
                 <span className="text-[10px] text-cyan-800 font-mono bg-cyan-950/20 px-3 py-1 rounded border border-cyan-900/30">
                    RAW: {reading.rawHex || 'N/A'}
                 </span>
             </div>
        </div>
    );
  }

  // --- TRAFFIC LIGHT VALIDATION LOGIC ---
  let isConfigCorrect = true;
  let validationMessage = '';

  if (selectedPreset && selectedPreset.allowedModes.length > 0) {
    // If the reading mode is NOT in the allowed list
    if (!selectedPreset.allowedModes.includes(reading.mode)) {
        isConfigCorrect = false;
        validationMessage = `Wrong Mode! Switch to ${selectedPreset.allowedModes[0]}`;
    }
  }

  const isHighVoltage = reading.value > 50 && reading.unit.includes('V');
  const isAuto = reading.rawHex?.includes('[AUTO]');

  // Determine container styles based on validation
  let borderColor = 'border-cyan-500/30';
  let shadowColor = 'shadow-[0_0_20px_rgba(6,182,212,0.1)]';
  let bgColor = 'bg-slate-900';

  if (!isConfigCorrect) {
      // RED LIGHT - Configuration Error
      borderColor = 'border-red-500';
      shadowColor = 'shadow-[0_0_30px_rgba(239,68,68,0.4)]';
      bgColor = 'bg-red-950/20';
  } else if (selectedPreset && selectedPreset.id !== 'general_check') {
      // GREEN LIGHT - Ready for Preset
      borderColor = 'border-green-500';
      shadowColor = 'shadow-[0_0_30px_rgba(34,197,94,0.3)]';
      bgColor = 'bg-green-950/10';
  } else if (isHighVoltage) {
      // RED FLASH - High Voltage Warning
      borderColor = 'border-red-500/50';
      shadowColor = 'shadow-[0_0_30px_rgba(220,38,38,0.2)]';
      bgColor = 'bg-red-950/30';
  }

  return (
    <div className={`w-full h-64 rounded-xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${bgColor} ${borderColor} ${shadowColor}`}>
      
      {/* --- PRESET GUIDANCE OVERLAY --- */}
      {selectedPreset && selectedPreset.id !== 'general_check' && (
          <div className="absolute top-2 right-2 flex flex-col items-end pointer-events-none z-20">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${isConfigCorrect ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'}`}>
                  <div className={`w-2 h-2 rounded-full ${isConfigCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                  {isConfigCorrect ? 'READY' : 'CHECK DIAL'}
              </div>
          </div>
      )}

      {/* Warning Banner */}
      {(!isConfigCorrect || isHighVoltage) && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 animate-pulse z-30">
          {!isConfigCorrect ? validationMessage : 'DANGER: HIGH VOLTAGE'}
        </div>
      )}

      {/* Leads Configuration Hint */}
      {selectedPreset && (
          <div className="absolute bottom-12 left-0 right-0 flex justify-center opacity-70">
              <div className="flex gap-4 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-4 py-1 rounded-full border border-slate-800">
                 <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    Connect to: <span className="text-white">{selectedPreset.leadConfig.redPort}</span>
                 </span>
                 <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-black border border-slate-600 rounded-full" />
                    Connect to: <span className="text-white">{selectedPreset.leadConfig.blackPort}</span>
                 </span>
              </div>
          </div>
      )}

      {/* Top Bar: Mode & Indicators */}
      <div className="absolute top-6 left-6 flex items-center gap-4 text-slate-400 text-sm font-mono z-10">
        <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">{reading.mode}</span>
        {isAuto && <span className="text-cyan-600 font-bold">AUTO</span>}
        {reading.isHold && <span className="text-yellow-500">HOLD</span>}
        {reading.isLowBattery && <span className="text-red-500">LOW BATT</span>}
      </div>

      {/* Main Digits */}
      <div className="flex items-baseline gap-2 z-10 mt-[-10px]">
        <h1 className={`text-7xl md:text-8xl font-mono font-bold tracking-tighter
          ${!isConfigCorrect ? 'text-slate-600 blur-[2px] transition-all' : (isHighVoltage ? 'text-red-500' : 'text-cyan-400')}
          drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]
        `}>
          {reading.value}
        </h1>
        <span className="text-4xl text-slate-500 font-light">{reading.unit}</span>
      </div>

      {/* Analog Bar Graph Simulation */}
      <div className="absolute bottom-8 w-3/4 h-2 bg-slate-800 rounded-full overflow-hidden opacity-50">
        <div 
           className={`h-full transition-all duration-150 ease-out ${isHighVoltage ? 'bg-red-500' : 'bg-cyan-500'}`}
           style={{ width: `${Math.min(Math.abs(reading.value) * 5, 100)}%` }} 
        />
      </div>

      {/* Raw Data Debug - Always Visible */}
      <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-2">
         <span className="text-[10px] text-slate-600 font-mono bg-slate-950/50 px-2 rounded">
            RAW: {reading.rawHex || 'N/A'}
         </span>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { MeterDisplay } from './components/MeterDisplay';
import { HistoryChart } from './components/HistoryChart';
import { ChatInterface } from './components/ChatInterface';
import { PresetSelector } from './components/PresetSelector';
import { useMultimeter } from './hooks/useMultimeter';
import { ConnectionStatus, MultimeterReading, TroubleshootingPreset, AI_GUIDED_PRESET_ID } from './types';
import { PRESETS } from './constants';

const App: React.FC = () => {
  const { status, reading, connect, disconnect, error } = useMultimeter();
  const [history, setHistory] = useState<MultimeterReading[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<TroubleshootingPreset>(PRESETS[0]); 
  
  // Safety State
  const [hasAcceptedSafety, setHasAcceptedSafety] = useState(false);
  const [isSafetyChecked, setIsSafetyChecked] = useState(false);

  // Dynamic Preset State (for AI Control)
  // When AI requests a mode, we modify this object directly if the current preset is "AI Guided"
  const [aiRequestedMode, setAiRequestedMode] = useState<string | null>(null);

  // Update history when new reading arrives
  useEffect(() => {
    if (reading) {
      setHistory(prev => {
        const newHist = [...prev, reading];
        if (newHist.length > 100) return newHist.slice(-100);
        return newHist;
      });
    }
  }, [reading]);

  // Handle AI Commands
  const handleAiModeRequest = (mode: string) => {
      setAiRequestedMode(mode);
      
      // Auto-switch to AI preset if not already there, so the user sees the safety validation immediately
      const aiPreset = PRESETS.find(p => p.id === AI_GUIDED_PRESET_ID);
      if (aiPreset && selectedPreset.id !== AI_GUIDED_PRESET_ID) {
          setSelectedPreset(aiPreset);
      }
  };

  // Derive the effective preset to pass to MeterDisplay
  const effectivePreset: TroubleshootingPreset = React.useMemo(() => {
      if (selectedPreset.id === AI_GUIDED_PRESET_ID && aiRequestedMode) {
          return {
              ...selectedPreset,
              allowedModes: [aiRequestedMode],
              description: `AI Requesting: ${aiRequestedMode}`,
              leadConfig: { 
                  redPort: "VΩHz", 
                  blackPort: "COM", 
                  notes: `Set meter to ${aiRequestedMode}` 
              }
          };
      }
      return selectedPreset;
  }, [selectedPreset, aiRequestedMode]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Meter & Hardware Controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Header */}
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              SparkSense
            </h1>
            <p className="text-slate-400 text-sm">AI-Assisted Electrical Diagnostics</p>
          </header>

          {/* Safety Disclaimer Card */}
          {!hasAcceptedSafety && (
            <div className="bg-red-900/20 border border-red-500/40 rounded-lg p-4 mb-3 text-sm text-red-100 animate-fade-in">
              <h3 className="font-bold text-red-200 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Electrical Safety Warning
              </h3>
              <p className="mb-3 text-red-100/90 leading-relaxed">
                SparkSense is an informational diagnostics tool. It does not determine whether electrical work is safe.
                It does not replace a multimeter, PPE, lockout/tagout, or proper electrical training.
                Only qualified personnel should perform electrical measurements or work on energized equipment.
                By continuing, you acknowledge these risks and assume all responsibility for how you use this tool.
              </p>
              
              <label className="flex items-start mb-4 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 w-4 h-4 mr-2 rounded border-red-500 bg-red-900/50 text-cyan-600 focus:ring-offset-0 focus:ring-1 focus:ring-cyan-500"
                  checked={isSafetyChecked}
                  onChange={(e) => setIsSafetyChecked(e.target.checked)}
                />
                <span className="text-xs text-slate-200">
                  I am qualified to perform electrical work and I understand SparkSense does not guarantee my safety.
                </span>
              </label>

              <button
                onClick={() => setHasAcceptedSafety(true)}
                disabled={!isSafetyChecked}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded px-4 py-2 transition-all flex items-center justify-center gap-2"
              >
                I Understand and Accept
              </button>
            </div>
          )}

          {/* Connection Panel */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                    status === ConnectionStatus.CONNECTED ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                    status === ConnectionStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 'bg-slate-600'
                }`} />
                <span className="font-mono text-sm font-medium text-slate-300">
                  {status === ConnectionStatus.CONNECTED ? 'DEVICE ACTIVE' : 'DISCONNECTED'}
                </span>
              </div>
              
              <div className="flex gap-2">
                  {status === ConnectionStatus.DISCONNECTED ? (
                    <>
                      <button 
                          onClick={() => connect(false)} 
                          disabled={!hasAcceptedSafety}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors flex items-center gap-2"
                      >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Connect
                      </button>
                       <button 
                          onClick={() => connect(true)} 
                          disabled={!hasAcceptedSafety}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-sm font-bold rounded transition-colors"
                          title="Use simulated data for demo"
                      >
                          Demo
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={disconnect}
                      className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 text-sm font-bold rounded transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
              </div>
            </div>
            
            {/* Helper text for gated controls */}
            {!hasAcceptedSafety && (
                <div className="mt-3 text-xs text-center text-slate-500 animate-pulse">
                   Review and accept the electrical safety warning above before continuing.
                </div>
            )}
          </div>

          {error && (
             <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded text-sm animate-fade-in">
                Error: {error}
             </div>
          )}

          {/* Preset Selector */}
          <PresetSelector 
             selectedPreset={selectedPreset} 
             onSelect={(p) => {
                 setSelectedPreset(p);
                 setAiRequestedMode(null); // Reset manual AI overrides when user manually switches presets
             }} 
          />

          {/* Main Meter Display */}
          <MeterDisplay 
             reading={reading} 
             status={status} 
             selectedPreset={effectivePreset}
          />

          {/* Quick Stats / Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Peak Max</div>
                <div className="text-lg font-mono text-slate-200">
                    {history.length > 0 
                        ? Math.max(...history.map(h => h.value)).toFixed(2) 
                        : '--'}
                </div>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Peak Min</div>
                <div className="text-lg font-mono text-slate-200">
                    {history.length > 0 
                        ? Math.min(...history.map(h => h.value)).toFixed(2) 
                        : '--'}
                </div>
            </div>
          </div>

          {/* Chart */}
          <HistoryChart history={history} />
        </div>

        {/* Right Column: AI Assistant (7 Cols) */}
        <div className="lg:col-span-7 h-[600px] lg:h-auto">
            <ChatInterface 
                currentReading={reading} 
                onAiModeRequest={handleAiModeRequest}
            />
        </div>
      </div>
    </div>
  );
};

export default App;
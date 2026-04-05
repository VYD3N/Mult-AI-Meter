import React from 'react';
import { PRESETS } from '../constants';
import { TroubleshootingPreset } from '../types';

interface PresetSelectorProps {
  selectedPreset: TroubleshootingPreset | null;
  onSelect: (preset: TroubleshootingPreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ selectedPreset, onSelect }) => {
  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        Troubleshooting Presets
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {PRESETS.map((preset) => {
          const isActive = selectedPreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className={`text-left px-3 py-2 rounded-md border transition-all duration-200 flex flex-col gap-0.5
                ${isActive 
                  ? 'bg-cyan-950/50 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]' 
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                }
              `}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-sm font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                  {preset.name}
                </span>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                )}
              </div>
              <span className="text-[10px] text-slate-500 line-clamp-1">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
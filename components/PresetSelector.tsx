import React from 'react';
import { PRESETS } from '../constants';
import { TroubleshootingPreset } from '../types';

interface PresetSelectorProps {
  selectedPreset: TroubleshootingPreset | null;
  onSelect: (preset: TroubleshootingPreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ selectedPreset, onSelect }) => {
  return (
    <div className="preset-shell">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Touch Modes</span>
          <h3 className="chat-title">Troubleshooting Presets</h3>
          <p className="muted-copy">Switch directly into guided checks inspired by the reference HUD panels.</p>
        </div>
      </div>

      <div className="preset-grid">
        {PRESETS.map((preset) => {
          const isActive = selectedPreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className={`preset-button ${isActive ? 'active' : ''}`}
            >
              <span className="preset-name">{preset.name}</span>
              <span className="preset-copy">{preset.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

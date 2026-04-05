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

  const statusLabel =
    status === ConnectionStatus.CONNECTED
      ? 'Probe link stable'
      : status === ConnectionStatus.CONNECTING
        ? 'Negotiating device link'
        : status === ConnectionStatus.ERROR
          ? 'Fault state detected'
          : 'Idle / disconnected';

  const latestValue = reading ? `${reading.value} ${reading.unit}` : '--';
  const peakMax = history.length > 0 ? Math.max(...history.map((h) => h.value)).toFixed(2) : '--';
  const peakMin = history.length > 0 ? Math.min(...history.map((h) => h.value)).toFixed(2) : '--';


  return (
    <div className="app-shell">
      <div className="scanline-overlay" aria-hidden="true" />

      <div className="hud-shell">
        <header className="hud-nav">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <div>
              <span className="brand-title">Mult-AI-Meter</span>
              <span className="brand-subtitle">Diagnostic console</span>
            </div>
          </div>

          <div className="nav-actions">
            <div className="status-pill">
              <span className="status-pill-dot" />
              {statusLabel}
            </div>
            <div className={`status-chip ${hasAcceptedSafety ? '' : 'warning'}`}>
              {hasAcceptedSafety ? 'Safety acknowledged' : 'Safety lock active'}
            </div>
            {status === ConnectionStatus.DISCONNECTED ? (
              <>
                <button className="hud-button" onClick={() => connect(false)} disabled={!hasAcceptedSafety} type="button">Connect meter</button>
                <button className="hud-button-secondary" onClick={() => connect(true)} disabled={!hasAcceptedSafety} type="button">Demo feed</button>
              </>
            ) : (
              <button className="hud-button-secondary" onClick={disconnect} type="button">Disconnect</button>
            )}
          </div>
        </header>

        <div className="hud-grid">
          <div className="hud-column">
            <section className="hud-panel">
              <div className="panel-header">
                <div>
                  <span className="panel-kicker">Vector Interface</span>
                  <h1 className="panel-title">Electrical Diagnosis Console</h1>
                  <p className="panel-copy">The current UI is rewired into a cinematic HUD layout inspired by your references while keeping live meter, preset, and AI workflow intact.</p>
                </div>
                <div className="status-group controls-mobile">
                  <div className="hud-chip">Preset {effectivePreset.name}</div>
                  <div className={`status-chip ${error ? 'danger' : ''}`}>{error || 'No transport errors'}</div>
                </div>
              </div>

              <div className="telemetry-grid">
                <article>
                  <div className="telemetry-label">Live Reading</div>
                  <div className="telemetry-value">{latestValue}</div>
                </article>
                <article>
                  <div className="telemetry-label">Meter Mode</div>
                  <div className="telemetry-value small">{reading?.mode || 'Awaiting signal'}</div>
                </article>
                <article>
                  <div className="telemetry-label">Peak Max</div>
                  <div className="telemetry-value">{peakMax}</div>
                </article>
                <article>
                  <div className="telemetry-label">Peak Min</div>
                  <div className="telemetry-value">{peakMin}</div>
                </article>
              </div>
            </section>

            {!hasAcceptedSafety && (
              <section className="safety-shell">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">Warning</span>
                    <h2 className="chat-title">Electrical Safety Gate</h2>
                    <p className="panel-copy">
                      This interface is informational only. It does not determine whether work is safe. Use qualified judgment, PPE, and lockout procedures.
                    </p>
                  </div>
                </div>

                <label className="safety-checkbox">
                  <input
                    type="checkbox"
                    checked={isSafetyChecked}
                    onChange={(e) => setIsSafetyChecked(e.target.checked)}
                  />
                  <span>I am qualified to perform electrical diagnostics and I understand the app does not guarantee safety.</span>
                </label>

                <div className="safety-actions">
                  <button className="hud-button" onClick={() => setHasAcceptedSafety(true)} disabled={!isSafetyChecked} type="button">
                    Unlock console
                  </button>
                  <div className="status-chip warning">Controls remain gated until this is acknowledged</div>
                </div>
              </section>
            )}

            <section className="status-bar">
              <div className="status-group">
                <div className={`status-chip ${status === ConnectionStatus.ERROR ? 'danger' : status === ConnectionStatus.CONNECTING ? 'warning' : ''}`}>{status}</div>
                <div className="hud-chip">AI-requested mode {aiRequestedMode || 'None'}</div>
              </div>
              <div className="status-group">
                {status === ConnectionStatus.DISCONNECTED && <div className="hud-chip">Accept safety gate to enable controls</div>}
                {reading?.isLowBattery && <div className="status-chip danger">Meter battery low</div>}
              </div>
            </section>

            <MeterDisplay
              reading={reading}
              status={status}
              selectedPreset={effectivePreset}
            />

            <PresetSelector
              selectedPreset={selectedPreset}
              onSelect={(p) => {
                setSelectedPreset(p);
                setAiRequestedMode(null);
              }}
            />

            <HistoryChart history={history} />
          </div>

          <div className="hud-column">
            <ChatInterface currentReading={reading} onAiModeRequest={handleAiModeRequest} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

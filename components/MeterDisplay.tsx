import React from 'react';
import { MultimeterReading, ConnectionStatus, TroubleshootingPreset } from '../types';

interface MeterDisplayProps {
  reading: MultimeterReading | null;
  status: ConnectionStatus;
  selectedPreset: TroubleshootingPreset | null;
}

export const MeterDisplay: React.FC<MeterDisplayProps> = ({ reading, status, selectedPreset }) => {
  const renderWaiting = (title: string, subtitle: string, stateClass = '') => (
    <div className={`meter-display ${stateClass}`}>
      <div className="meter-topline">
        <div className="status-chip warning">Signal Buffer</div>
        <div className="hud-chip">Awaiting telemetry</div>
      </div>

      <div className="meter-center">
        <div className="meter-radar">
          <div className="meter-sweep" />
          <div className="meter-crosshair" />
        </div>

        <div className="meter-reading">
          <div className="meter-mode">Diagnostic stream</div>
          <div className="meter-value">
            <div className="meter-value-number">--.--</div>
            <div className="meter-value-unit">SCAN</div>
          </div>
          <p className="muted-copy">{title}</p>
          <div className="meter-guidance">
            <div className="guide-card">
              <span className="guide-card-label">Console State</span>
              <span className="guide-card-value">{subtitle}</span>
            </div>
            <div className="guide-card">
              <span className="guide-card-label">Expected Feed</span>
              <span className="guide-card-value">Live OWON BLE frame capture</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (status !== ConnectionStatus.CONNECTED || !reading) {
    return renderWaiting(
      status === ConnectionStatus.CONNECTING ? 'Negotiating Bluetooth link and enumerating services.' : 'Waiting for signal from the meter or simulator.',
      status === ConnectionStatus.CONNECTING ? 'Handshake in progress' : 'No active reading',
      status === ConnectionStatus.CONNECTING ? 'syncing' : ''
    );
  }

  const isInvalid = !reading.isValid;

  if (isInvalid) {
    return renderWaiting(
      'The transport is live but the frame parser is still aligning to a valid measurement packet.',
      `Protocol ${reading.rawHex?.includes('ALT') ? 'ZOYI-ALT' : 'OWON-B35'}`,
      'syncing'
    );
  }

  let isConfigCorrect = true;
  let validationMessage = '';

  if (selectedPreset && selectedPreset.allowedModes.length > 0) {
    if (!selectedPreset.allowedModes.includes(reading.mode)) {
        isConfigCorrect = false;
        validationMessage = `Wrong Mode! Switch to ${selectedPreset.allowedModes[0]}`;
    }
  }

  const isHighVoltage = reading.value > 50 && reading.unit.includes('V');
  const isAuto = reading.rawHex?.includes('[AUTO]');

  let stateClass = '';
  let statusLabel = 'Signal nominal';

  if (!isConfigCorrect) {
      stateClass = 'error';
      statusLabel = validationMessage;
  } else if (selectedPreset && selectedPreset.id !== 'general_check') {
      stateClass = 'ready';
      statusLabel = 'Preset aligned';
  } else if (isHighVoltage) {
      stateClass = 'error';
      statusLabel = 'High voltage hazard';
  }

  return (
    <div className={`meter-display ${stateClass}`}>
      <div className="meter-topline">
        <div className={`status-chip ${!isConfigCorrect || isHighVoltage ? 'danger' : selectedPreset && selectedPreset.id !== 'general_check' ? 'warning' : ''}`}>
          {statusLabel}
        </div>
        <div className="status-group">
          <div className="hud-chip">{reading.mode}</div>
          {isAuto && <div className="hud-chip">Auto</div>}
          {reading.isHold && <div className="hud-chip">Hold</div>}
          {reading.isLowBattery && <div className="status-chip danger">Low Battery</div>}
        </div>
      </div>

      {(!isConfigCorrect || isHighVoltage) && (
        <div className="warning-banner">{!isConfigCorrect ? validationMessage : 'Danger: verify PPE, leads, and de-energize if possible before proceeding.'}</div>
      )}

      <div className="meter-center">
        <div className="meter-radar">
          <div className="meter-sweep" />
          <div className="meter-crosshair" />
        </div>

        <div className="meter-reading">
          <div className="meter-mode">Live measurement vector</div>
          <div className="meter-value">
            <div className="meter-value-number">{reading.value}</div>
            <div className="meter-value-unit">{reading.unit}</div>
          </div>
          <p className="muted-copy">
            {selectedPreset?.description || 'Freeform measurement stream'}
          </p>

          <div className="meter-guidance">
            <div className="guide-card">
              <span className="guide-card-label">Red Lead</span>
              <span className="guide-card-value">{selectedPreset?.leadConfig.redPort || 'VOhmHz'}</span>
            </div>
            <div className="guide-card">
              <span className="guide-card-label">Black Lead</span>
              <span className="guide-card-value">{selectedPreset?.leadConfig.blackPort || 'COM'}</span>
            </div>
            <div className="guide-card">
              <span className="guide-card-label">Expected Range</span>
              <span className="guide-card-value">
                {selectedPreset?.expectedValueRange
                  ? `${selectedPreset.expectedValueRange.min}-${selectedPreset.expectedValueRange.max} ${selectedPreset.expectedValueRange.unit}`
                  : 'Adaptive / unknown'}
              </span>
            </div>
            <div className="guide-card">
              <span className="guide-card-label">Raw Frame</span>
              <span className="guide-card-value">{reading.rawHex || 'N/A'}</span>
            </div>
          </div>

          <div className="signal-bar">
            <div className="signal-bar-fill" style={{ width: `${Math.min(Math.abs(reading.value) * 5, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="meter-bottomline">
        <div className="hud-chip">Validity {reading.isValid ? 'Locked' : 'Pending'}</div>
        {selectedPreset?.safetyWarning && <div className="status-chip danger">{selectedPreset.safetyWarning}</div>}
      </div>
    </div>
  );
};

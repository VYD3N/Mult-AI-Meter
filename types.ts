export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface MultimeterReading {
  value: number;
  unit: string; // V, A, Ohm, etc.
  mode: string; // DC, AC, Resistance, Continuity
  timestamp: number;
  isOverLimit: boolean;
  isHold: boolean;
  isLowBattery: boolean;
  isValid: boolean; // Distinguishes between valid measurements and heartbeat/noise
  rawHex?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  relatedReading?: MultimeterReading; // Context snapshot
  image?: string; // Base64 encoded image
  context?: {
    deviceName?: string;
    goal?: string;
  };
}

export type MeasurementType = 'Voltage DC' | 'Voltage AC' | 'Current' | 'Resistance' | 'Capacitance' | 'Frequency' | 'Temperature';

export interface LeadConfiguration {
  redPort: string; // e.g., "VΩHz", "mA", "10A"
  blackPort: string; // Always "COM"
  notes?: string;
}

export interface TroubleshootingPreset {
  id: string;
  name: string;
  description: string;
  allowedModes: string[]; // Modes valid for this test (e.g., ["DC Voltage"])
  requiredRange?: string; // Optional guidance
  leadConfig: LeadConfiguration;
  safetyWarning?: string;
  expectedValueRange?: { min: number; max: number; unit: string };
}

export const AI_GUIDED_PRESET_ID = "ai_guided";

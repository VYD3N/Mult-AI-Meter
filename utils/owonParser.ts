import { MultimeterReading } from "../types";

// Parses BLE data from various Bluetooth Multimeter chipsets
// Supports:
// 1. OWON B35/B41T+ (Strict 3-Word Protocol)
// 2. Zoyi/Aneng/BDM Generic (14 Byte Protocol)
// 3. ASCII Text Protocol

export const parseOwonData = (dataView: DataView): MultimeterReading | null => {
  try {
    const byteLength = dataView.byteLength;
    const bufferBytes = new Uint8Array(dataView.buffer, dataView.byteOffset, byteLength);
    
    // Debug: Generate Hex String
    const rawHex = Array.from(bufferBytes)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

    // Strategy 1: OWON B35/B41T+ (Strict 6 bytes / 3 Words)
    if (byteLength === 6) {
        return parseOwon6Byte(dataView, rawHex);
    } 
    
    // Strategy 2: Zoyi/Aneng/BDM (14 Bytes with Header)
    if (byteLength === 14 && bufferBytes[0] === 0xAB && bufferBytes[1] === 0xCD) {
        return parseZoyi14Byte(dataView, rawHex);
    }

    // Strategy 3: ASCII Text (e.g. "DC 09.00 V")
    if (isAscii(bufferBytes)) {
        return parseAscii(bufferBytes, rawHex);
    }

    // Fallback: Return Unknown Protocol with RAW HEX for display
    return {
        value: 0,
        unit: '',
        mode: 'Unknown',
        timestamp: Date.now(),
        isOverLimit: false,
        isHold: false,
        isLowBattery: false,
        isValid: false,
        rawHex: rawHex 
    };

  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
};

const isAscii = (bytes: Uint8Array): boolean => {
    let printable = 0;
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if ((b >= 0x20 && b <= 0x7E) || b === 0x0D || b === 0x0A) {
            printable++;
        }
    }
    return printable / bytes.length > 0.9;
};

const parseAscii = (bytes: Uint8Array, rawHex: string): MultimeterReading => {
    const text = new TextDecoder().decode(bytes).trim();
    const numberMatch = text.match(/([-+]?[0-9]*\.?[0-9]+)/);
    const value = numberMatch ? parseFloat(numberMatch[0]) : 0;

    let mode = 'Text Mode';
    let unit = '';
    
    if (text.includes('DC')) mode = 'DC Voltage';
    if (text.includes('AC')) mode = 'AC Voltage';
    if (text.includes('Ohm') || text.includes('Ω')) { mode = 'Resistance'; unit = 'Ω'; }
    if (text.includes('V')) unit = 'V';
    if (text.includes('A') && !text.includes('AC')) unit = 'A';
    
    return {
        value,
        unit,
        mode,
        timestamp: Date.now(),
        isOverLimit: false,
        isHold: false,
        isLowBattery: false,
        isValid: true,
        rawHex
    };
};

// --- Protocol 1: OWON B35/B41T+ (6 Bytes / 3 Words) ---
// Based on https://github.com/DeanCording/owonb35
const parseOwon6Byte = (view: DataView, rawHex: string): MultimeterReading => {
    // The B35 protocol consists of 3 Little-Endian Uint16 words.
    
    // Word 1: Function (Bits 6-9), Scale (Bits 3-5), Decimal (Bits 0-2)
    const word1 = view.getUint16(0, true);
    
    // Word 2: Status Flags (Hold, Auto, LowBatt, etc)
    const word2 = view.getUint16(2, true);
    
    // Word 3: Measurement Value (Signed Magnitude)
    const word3 = view.getUint16(4, true);

    // --- DECODE WORD 1 ---
    const funcCode = (word1 >> 6) & 0x0F;
    const scaleCode = (word1 >> 3) & 0x07;
    const decimalCode = word1 & 0x07;

    // --- DECODE WORD 2 (Status) ---
    // Mapping based on owonb35 documentation
    // 0x01: Autorange (or 0x05)
    // 0x02: Autorange (or 0x06)
    // 0x04: Autorange
    // 0x10: Low Battery
    // 0x20: Min
    // 0x40: Max
    // Note: Some sources say Hold is in here too, or sent as separate command response.
    // We will treat bit 0 or similar as Auto based on observation "04" in byte 2.
    const isAuto = (word2 & 0x04) !== 0 || (word2 & 0x02) !== 0;
    // Common masks for Low Batt often vary, but let's assume bit 4 based on doc
    const isLowBatt = (word2 & 0x10) !== 0;
    // Hold is often Bit 8 or similar in full status, but simpler meters might not send it reliably here.
    const isHold = false; 

    // --- DECODE WORD 3 (Value) ---
    // Signed Magnitude: MSB indicates negative.
    // 0x7FFF is max positive. 0x8001 is -1.
    let rawValue = word3;
    let multiplier = 1.0;
    
    // Handle Overload
    const isOverLimit = decimalCode === 0x07 || rawValue === 0xFFFF;

    let measurement = 0;
    if (!isOverLimit) {
        if (rawValue < 0x7FFF) {
            measurement = rawValue;
        } else {
            measurement = -1.0 * (rawValue & 0x7FFF);
        }
        
        // Apply Decimal Point
        if (decimalCode < 7) {
            measurement = measurement / Math.pow(10, decimalCode);
        }
    }

    // --- APPLY SCALE ---
    let scaleMultiplier = 1.0;
    let scaleSuffix = '';
    
    switch (scaleCode) {
        case 0: scaleMultiplier = 1.0; break; 
        case 1: scaleMultiplier = 1e-9; scaleSuffix = 'n'; break;
        case 2: scaleMultiplier = 1e-6; scaleSuffix = 'µ'; break;
        case 3: scaleMultiplier = 1e-3; scaleSuffix = 'm'; break;
        case 4: scaleMultiplier = 1.0; break;
        case 5: scaleMultiplier = 1e3; scaleSuffix = 'k'; break;
        case 6: scaleMultiplier = 1e6; scaleSuffix = 'M'; break;
    }

    // --- DETERMINE MODE ---
    let mode = 'Unknown';
    let unit = '';

    switch (funcCode) {
        case 0x0: mode = 'DC Voltage'; unit = 'V'; break;
        case 0x1: mode = 'AC Voltage'; unit = 'V'; break;
        case 0x2: mode = 'DC Current'; unit = 'A'; break;
        case 0x3: mode = 'AC Current'; unit = 'A'; break;
        case 0x4: mode = 'Resistance'; unit = 'Ω'; break;
        case 0x5: mode = 'Capacitance'; unit = 'F'; break;
        case 0x6: mode = 'Frequency'; unit = 'Hz'; break;
        case 0x7: mode = 'Duty Cycle'; unit = '%'; break;
        case 0x8: mode = 'Temperature'; unit = '°C'; break;
        case 0x9: mode = 'Temperature'; unit = '°F'; break;
        case 0xA: mode = 'Diode'; unit = 'V'; break;
        case 0xB: mode = 'Continuity'; unit = 'Ω'; break;
        case 0xC: mode = 'hFE'; unit = ''; break;
        default: mode = `Mode ${funcCode}`;
    }

    const finalValue = measurement * scaleMultiplier;
    const finalUnit = scaleSuffix + unit;

    return {
        value: Number(finalValue.toPrecision(6)), // Avoid float artifacts
        unit: finalUnit,
        mode,
        timestamp: Date.now(),
        isOverLimit,
        isHold,
        isLowBattery: isLowBatt,
        isValid: true, // Always valid for this protocol
        rawHex: rawHex + (isAuto ? ' [AUTO]' : '')
    };
};

// --- Protocol 2: Zoyi / BDM / Aneng (14 Bytes) ---
const parseZoyi14Byte = (view: DataView, rawHex: string): MultimeterReading | null => {
    const functionCode = view.getUint8(6);
    if (functionCode === 0) return null;

    const rangeCode = view.getUint8(7);
    let rawValue = view.getUint16(9, true); 
    const statusByte = view.getUint8(11);
    const isNegative = (statusByte & 0x08) !== 0; 
    const isAuto = (statusByte & 0x20) !== 0; // Approx location for Zoyi auto

    // HEURISTIC: "Ghost 6.15" Fix
    let usedAltProtocol = false;
    if (rawValue >= 610 && rawValue <= 620) {
        const altValue = view.getUint16(4, true);
        if (altValue !== rawValue) {
            rawValue = altValue;
            usedAltProtocol = true;
        }
    }

    const decimalPos = rangeCode & 0x07;
    let multiplier = 1.0;
    switch(decimalPos) {
        case 0: multiplier = 1.0; break;
        case 1: multiplier = 0.1; break;
        case 2: multiplier = 0.01; break;
        case 3: multiplier = 0.001; break;
        case 4: multiplier = 0.0001; break;
    }

    let mode = 'Unknown';
    let unit = '';

    if ((functionCode >= 0x20 && functionCode <= 0x2F) || functionCode === 0xA0) { mode = 'DC Voltage'; unit = 'V'; }
    else if (functionCode === 0xA1 || (functionCode & 0xF0) === 0x30) { mode = 'AC Voltage'; unit = 'V'; }
    else if (functionCode === 0xA2 || (functionCode & 0xF0) === 0x40) { mode = 'Resistance'; unit = 'Ω'; }
    else if (functionCode === 0xA4) { mode = 'Continuity'; unit = 'Ω'; }
    else if (functionCode === 0xA6) { mode = 'Frequency'; unit = 'Hz'; }
    else if (functionCode === 0xC0 || (functionCode & 0xF0) === 0x80) { mode = 'DC Current'; unit = 'A'; }
    else { mode = `Mode 0x${functionCode.toString(16)}`; }

    let finalValue = rawValue * multiplier;
    if (isNegative) finalValue = -finalValue;

    return {
        value: Number(finalValue.toFixed(4)),
        unit,
        mode: mode,
        timestamp: Date.now(),
        isOverLimit: rawValue === 0xFFFF,
        isHold: false, 
        isLowBattery: false,
        isValid: true,
        rawHex: rawHex + (usedAltProtocol ? ' (ALT)' : '') + (isAuto ? ' [AUTO]' : '')
    };
};

// Simulation
export const generateSimulatedReading = (tick: number): MultimeterReading => {
  const voltage = 9 + Math.sin(tick / 20) * 0.05;
  return {
    value: Number(voltage.toFixed(2)),
    unit: 'V',
    mode: 'Voltage DC (Sim)',
    timestamp: Date.now(),
    isOverLimit: false,
    isHold: false,
    isLowBattery: false,
    isValid: true,
    rawHex: 'Simulated Data'
  };
};

import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus, MultimeterReading } from '../types';
import { OWON_SERVICE_UUID, OWON_CHARACTERISTIC_NOTIFY, SERIAL_SERVICE_UUID, SERIAL_CHARACTERISTIC_UUID } from '../constants';
import { parseOwonData, generateSimulatedReading } from '../utils/owonParser';

// --- Web Bluetooth API Type Definitions ---

interface BluetoothRequestDeviceFilter {
  services?: (string | number)[];
  name?: string;
  namePrefix?: string;
  manufacturerData?: { [key: number]: { dataPrefix?: number[]; mask?: number[] } }[];
  serviceData?: { [key: string]: { dataPrefix?: number[]; mask?: number[] } }[];
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: (string | number)[];
  acceptAllDevices?: boolean;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>;
  includedServices: BluetoothRemoteGATTService[];
  getIncludedService(service: string | number): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  value?: DataView;
  getDescriptor(descriptor: string | number): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: string | number): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface BluetoothCharacteristicProperties {
  broadcast: boolean;
  read: boolean;
  writeWithoutResponse: boolean;
  write: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites: boolean;
  reliableWrite: boolean;
  writableAuxiliaries: boolean;
}

interface BluetoothRemoteGATTDescriptor {
  characteristic: BluetoothRemoteGATTCharacteristic;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements(): void;
  readonly watchingAdvertisements: boolean;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

// Augment the Navigator interface
declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

// ------------------------------------------

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useMultimeter = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [reading, setReading] = useState<MultimeterReading | null>(null);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const simulationTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number>(0);

  // Parse incoming BLE data
  const handleCharacteristicValueChanged = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    
    // Use the real parser logic
    const parsed = parseOwonData(value);
    
    if (parsed) {
        setReading(parsed);
    } else {
        // Fallback debug logging if parsing fails completely
        const hex = Array.from(new Uint8Array(value.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log("Received unparseable BLE Data:", hex);
    }
  };

  const connect = async (simulate: boolean = false) => {
    setError(null);
    setStatus(ConnectionStatus.CONNECTING);

    if (simulate) {
      startSimulation();
      return;
    }

    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser. Try Chrome or Edge.");
      }

      // Request Device with broad optional services to ensure we can access whatever the BDM uses
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
            { namePrefix: "OWON" }, 
            { namePrefix: "BDM" },
            { services: [OWON_SERVICE_UUID] },
            { services: [SERIAL_SERVICE_UUID] }
        ],
        optionalServices: [
            OWON_SERVICE_UUID, 
            SERIAL_SERVICE_UUID, 
            "generic_access",
            // Add 16-bit short UUIDs as strings just in case browser needs them explicitly
            "0000fff0-0000-1000-8000-00805f9b34fb",
            "0000ffe0-0000-1000-8000-00805f9b34fb"
        ]
      });

      setDevice(device);
      device.addEventListener('gattserverdisconnected', onDisconnected);

      // RETRY LOGIC FOR CONNECTION
      let server: BluetoothRemoteGATTServer | undefined;
      let connectAttempts = 0;
      const maxConnectRetries = 3;

      while (connectAttempts < maxConnectRetries) {
        try {
            connectAttempts++;
            server = await device.gatt?.connect();
            // Stabilize connection
            await wait(1000 + (connectAttempts * 500));
            if (server?.connected) break;
        } catch (e) {
            console.warn(`Connection attempt ${connectAttempts} failed:`, e);
            if (connectAttempts >= maxConnectRetries) throw e;
            await wait(1000);
        }
      }

      if (!server || !server.connected) {
          throw new Error("Device disconnected immediately after pairing. Please try again.");
      }

      // --- ROBUST SERVICE DISCOVERY ---
      let targetCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
      
      // 1. Get ALL services first (more reliable than requesting specific ones on some chips)
      let services: BluetoothRemoteGATTService[] = [];
      try {
          services = await server.getPrimaryServices();
          console.log("Discovered Services:", services.map(s => s.uuid));
      } catch (e) {
          console.warn("Could not list services:", e);
          throw new Error("Connected, but could not list device services.");
      }

      // 2. Scan for Known Multimeter Services (FFE0 or FFF0)
      // We use .includes() to handle case sensitivity and short vs long UUID issues
      const serialService = services.find(s => s.uuid.toLowerCase().includes("ffe0"));
      const owonService = services.find(s => s.uuid.toLowerCase().includes("fff0"));

      if (serialService) {
          console.log("Found Serial Service (FFE0)");
          try {
             targetCharacteristic = await serialService.getCharacteristic(SERIAL_CHARACTERISTIC_UUID);
          } catch (e) {
             // Fallback: try to find ANY notify char in this service
             const chars = await serialService.getCharacteristics();
             targetCharacteristic = chars.find(c => c.properties.notify) || null;
          }
      } else if (owonService) {
          console.log("Found OWON Service (FFF0)");
          try {
              targetCharacteristic = await owonService.getCharacteristic(OWON_CHARACTERISTIC_NOTIFY);
          } catch (e) {
              const chars = await owonService.getCharacteristics();
              targetCharacteristic = chars.find(c => c.properties.notify) || null;
          }
      }

      // 3. Universal Fallback: Scan ALL services for ANY notify characteristic
      if (!targetCharacteristic) {
          console.log("Standard services not found/usable. Scanning all services for Notify...");
          for (const service of services) {
              try {
                  const chars = await service.getCharacteristics();
                  const notifyChar = chars.find(c => c.properties.notify);
                  if (notifyChar) {
                      console.log(`Found candidate characteristic: ${notifyChar.uuid} in service ${service.uuid}`);
                      targetCharacteristic = notifyChar;
                      break;
                  }
              } catch (e) {
                  console.warn(`Cannot inspect service ${service.uuid}`, e);
              }
          }
      }

      if (!targetCharacteristic) {
          const foundUUIDs = services.map(s => s.uuid).join(", ");
          throw new Error(`Could not find a compatible data stream. Services found: ${foundUUIDs}`);
      }
      
      await targetCharacteristic.startNotifications();
      targetCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

      setStatus(ConnectionStatus.CONNECTED);

    } catch (err: any) {
      // Handle user cancellation gracefully
      if (err.name === 'NotFoundError' || err.message.includes('cancelled')) {
          setStatus(ConnectionStatus.DISCONNECTED);
          console.log("User cancelled Bluetooth chooser");
          return;
      }

      console.error(err);
      setError(err.message || "Connection Failed");
      setStatus(ConnectionStatus.ERROR);
      // Clean up if partially connected
      if (device && device.gatt?.connected) {
          device.gatt.disconnect();
      }
    }
  };

  const disconnect = () => {
    if (device && device.gatt?.connected) {
      device.gatt.disconnect();
    }
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    onDisconnected();
  };

  const onDisconnected = () => {
    setStatus(ConnectionStatus.DISCONNECTED);
    setDevice(null);
  };

  const startSimulation = () => {
    setStatus(ConnectionStatus.CONNECTED);
    if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    
    simulationTimerRef.current = window.setInterval(() => {
      tickRef.current += 1;
      setReading(generateSimulatedReading(tickRef.current));
    }, 500);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, []);

  return {
    status,
    reading,
    connect,
    disconnect,
    error
  };
};
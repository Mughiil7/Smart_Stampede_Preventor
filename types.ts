
export enum SafetyLevel {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED'
}

export interface UserState {
  id: string;
  userName?: string;
  safetyLevel: SafetyLevel;
  soundLevel: number;
  shakeCount: number;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  } | null;
  lastUpdate: number;
}

export interface Alert {
  id: string;
  userId: string;
  userName?: string;
  timestamp: number;
  safetyLevel: SafetyLevel;
  location: {
    lat: number;
    lng: number;
  } | null;
  reason: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

export interface AdminSettings {
  contacts: EmergencyContact[];
  autoCall: boolean;
  autoSMS: boolean;
  shakeThreshold: number;
  panicThreshold: number;
}

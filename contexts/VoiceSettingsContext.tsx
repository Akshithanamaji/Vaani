'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { setGlobalVoiceSettings } from '@/lib/voice-utils';

export type VoiceSpeed = 'slow' | 'normal' | 'fast';

const SPEED_MAP: Record<VoiceSpeed, string> = {
  slow: '0.24',
  normal: '1',
  fast: '1.5',
};

interface VoiceSettings {
  speed: VoiceSpeed;
  volume: number;
  repeatInstructions: boolean;
}

interface VoiceSettingsContextType {
  settings: VoiceSettings;
  setSpeed: (speed: VoiceSpeed) => void;
  setVolume: (volume: number) => void;
  setRepeatInstructions: (repeat: boolean) => void;
}

const defaultSettings: VoiceSettings = {
  speed: 'normal',
  volume: 1.0,
  repeatInstructions: true,
};

const VoiceSettingsContext = createContext<VoiceSettingsContextType | undefined>(undefined);

export function VoiceSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<VoiceSettings>(defaultSettings);

  // Load saved settings on mount
  useEffect(() => {
    const stored = localStorage.getItem('vaani_voice_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        // Apply immediately
        setGlobalVoiceSettings({
          speed: SPEED_MAP[parsed.speed as VoiceSpeed] || '1',
          volume: parsed.volume,
        });
      } catch (e) {
        console.error('Error parsing stored voice settings:', e);
      }
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('vaani_voice_settings', JSON.stringify(settings));
    // Apply to global voice utils
    setGlobalVoiceSettings({
      speed: SPEED_MAP[settings.speed],
      volume: settings.volume,
    });
  }, [settings]);

  const setSpeed = (speed: VoiceSpeed) => setSettings(prev => ({ ...prev, speed }));
  const setVolume = (volume: number) => setSettings(prev => ({ ...prev, volume }));
  const setRepeatInstructions = (repeatInstructions: boolean) => setSettings(prev => ({ ...prev, repeatInstructions }));

  return (
    <VoiceSettingsContext.Provider
      value={{
        settings,
        setSpeed,
        setVolume,
        setRepeatInstructions,
      }}
    >
      {children}
    </VoiceSettingsContext.Provider>
  );
}

export function useVoiceSettings() {
  const context = useContext(VoiceSettingsContext);
  if (context === undefined) {
    throw new Error('useVoiceSettings must be used within a VoiceSettingsProvider');
  }
  return context;
}

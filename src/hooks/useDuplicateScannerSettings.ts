import { useState, useEffect, useCallback } from 'react';

export interface DuplicateScannerSettings {
  // Hard exclusion thresholds
  minAddressSimilarity: number; // Below this AND name below threshold = exclude
  minNameSimilarity: number; // Below this AND address below threshold = exclude
  maxCapacityDifference: number; // Above this = exclude (percentage)
  
  // Medium confidence thresholds
  mediumAddressThreshold: number; // Address similarity >= this = medium confidence
  mediumNameThreshold: number; // Name similarity >= this = medium confidence
  
  // Address token overlap threshold
  minAddressTokenOverlap: number;
}

const DEFAULT_SETTINGS: DuplicateScannerSettings = {
  minAddressSimilarity: 40,
  minNameSimilarity: 40,
  maxCapacityDifference: 50,
  mediumAddressThreshold: 80,
  mediumNameThreshold: 75,
  minAddressTokenOverlap: 20,
};

const STORAGE_KEY = 'duplicate-scanner-settings';

export function useDuplicateScannerSettings() {
  const [settings, setSettings] = useState<DuplicateScannerSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load duplicate scanner settings:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: DuplicateScannerSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save duplicate scanner settings:', e);
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof DuplicateScannerSettings>(
    key: K,
    value: DuplicateScannerSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch (e) {
        console.error('Failed to save duplicate scanner settings:', e);
      }
      return newSettings;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to reset duplicate scanner settings:', e);
    }
  }, []);

  return {
    settings,
    isLoaded,
    saveSettings,
    updateSetting,
    resetToDefaults,
    defaultSettings: DEFAULT_SETTINGS,
  };
}

// Export for use in other hooks
export function getStoredSettings(): DuplicateScannerSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load duplicate scanner settings:', e);
  }
  return DEFAULT_SETTINGS;
}

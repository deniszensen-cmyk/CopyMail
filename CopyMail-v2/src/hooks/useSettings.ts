import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../utils/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  return { settings, loaded, update };
}

import { useState, useCallback } from "react";
import { STORAGE_VERSION } from "../config/constants.js";



function useLocalStorage(key, defaultValue) {
  const versionedKey = `v${STORAGE_VERSION}_${key}`;

  const [value, setValue] = useState(() => {
    try {
      const oldData = localStorage.getItem(key);
      const newData = localStorage.getItem(versionedKey);
      if (newData) return JSON.parse(newData);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          localStorage.setItem(versionedKey, JSON.stringify(parsed));
          localStorage.removeItem(key);
          return parsed;
        } catch { localStorage.removeItem(key); }
      }
      return defaultValue;
    } catch { return defaultValue; }
  });

  const setStoredValue = useCallback((newValue) => {
    setValue((prev) => {
      const val = typeof newValue === "function" ? newValue(prev) : newValue;
      try {
        localStorage.setItem(versionedKey, JSON.stringify(val));
      } catch (e) {
        if (e.name === "QuotaExceededError") {
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (k && k.startsWith("v") && k.includes("_mg_") && !k.startsWith(`v${STORAGE_VERSION}_`)) localStorage.removeItem(k);
            }
            localStorage.setItem(versionedKey, JSON.stringify(val));
          } catch { /* abaikan */ }
        }
      }
      return val;
    });
  }, [versionedKey]);

  return [value, setStoredValue];
}

export { useLocalStorage };


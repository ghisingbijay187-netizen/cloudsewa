import { useState, useEffect } from 'react';

const getInitial = (key, fallback) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // malformed value or storage unavailable — fall through to default
  }
  return fallback;
};

const useSessionState = (key, initialValue) => {
  const [value, setValue] = useState(() => getInitial(key, initialValue));

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full / unavailable — keep the in-memory value
    }
  }, [key, value]);

  return [value, setValue];
};

export default useSessionState;
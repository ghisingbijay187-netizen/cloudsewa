import { useState, useEffect } from 'react';

const getInitial = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // malformed value or storage unavailable — fall through to default
  }
  return fallback;
};

const useLocalState = (key, initialValue) => {
  const [value, setValue] = useState(() => getInitial(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full / unavailable — keep the in-memory value
    }
  }, [key, value]);

  return [value, setValue];
};

export default useLocalState;
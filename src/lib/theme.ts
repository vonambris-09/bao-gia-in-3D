import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'app_theme';

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // chế độ riêng tư / bị chặn cookie
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Theme sáng/tối. Lần đầu theo cài đặt hệ điều hành, sau đó theo lựa chọn
 * của người dùng và được nhớ lại giữa các lần mở.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme());

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* không lưu được thì thôi, vẫn chạy bình thường */
    }
  }, [theme]);

  // Theo hệ điều hành cho tới khi người dùng tự chọn
  useEffect(() => {
    if (readStored()) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggle };
}

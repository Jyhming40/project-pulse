/**
 * EPC 毛利門檻設定（localStorage）
 */

export interface MarginThresholds {
  greenAbove: number;
  yellowAbove: number;
}

const STORAGE_KEY = 'pulse_epc_margin_thresholds';

const DEFAULTS: MarginThresholds = {
  greenAbove: 0.18,
  yellowAbove: 0.12,
};

function isValid(t: MarginThresholds): boolean {
  return (
    typeof t.greenAbove === 'number' &&
    typeof t.yellowAbove === 'number' &&
    t.yellowAbove > 0 &&
    t.yellowAbove < t.greenAbove &&
    t.greenAbove < 1
  );
}

export function getMarginThresholds(): MarginThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as MarginThresholds;
    return isValid(parsed) ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function setMarginThresholds(t: MarginThresholds): boolean {
  if (!isValid(t)) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  return true;
}

export function getMarginColor(rate: number): 'green' | 'yellow' | 'red' {
  const t = getMarginThresholds();
  if (rate >= t.greenAbove) return 'green';
  if (rate >= t.yellowAbove) return 'yellow';
  return 'red';
}

export function getMarginBadgeClasses(color: 'green' | 'yellow' | 'red'): string {
  switch (color) {
    case 'green':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'yellow':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
}

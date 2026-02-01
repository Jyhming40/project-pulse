/**
 * 數值格式化工具
 * 提供統一的數值格式化函式，支援可配置的精度設定
 */

import { DEFAULT_PRECISION, NumberPrecisionConfig } from '@/hooks/useNumberPrecision';

// 全域快取精度設定（由 hook 更新）
let cachedPrecision: NumberPrecisionConfig = DEFAULT_PRECISION;

/**
 * 更新全域精度快取（由 useNumberPrecision hook 呼叫）
 */
export function updatePrecisionCache(config: NumberPrecisionConfig) {
  cachedPrecision = config;
}

/**
 * 取得目前精度設定
 */
export function getPrecision(): NumberPrecisionConfig {
  return cachedPrecision;
}

/**
 * 格式化新台幣金額
 */
export function formatTWD(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.currency_twd;
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
}

/**
 * 格式化美元金額
 */
export function formatUSD(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.currency_usd;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.rate_percent;
  return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化電力費率 (元/度)
 */
export function formatTariffRate(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.rate_tariff;
  return `$${value.toFixed(decimals)}`;
}

/**
 * 格式化裝置容量 (kWp)
 */
export function formatCapacity(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.capacity_kwp;
  return `${value.toFixed(decimals)} kWp`;
}

/**
 * 格式化發電度數 (kWh)
 */
export function formatGeneration(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.generation_kwh;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化年數
 */
export function formatYears(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.years;
  return value.toFixed(decimals);
}

/**
 * 格式化匯率
 */
export function formatExchangeRate(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.ratio_exchange;
  return value.toFixed(decimals);
}

/**
 * 格式化衰減率
 */
export function formatDegradationRate(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.ratio_degradation;
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化保險費率
 */
export function formatInsuranceRate(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.rate_insurance;
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化利率
 */
export function formatInterestRate(value: number, precision?: number): string {
  const decimals = precision ?? cachedPrecision.rate_interest;
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 通用數值格式化（帶千分位）
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 四捨五入到指定小數位
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

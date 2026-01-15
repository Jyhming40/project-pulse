import { useCodebook } from './useCodebook';

// Default UI labels - these are used as fallbacks if not configured in database
const defaultLabels: Record<string, string> = {
  'pending_documents': '送審中',
  'risk_projects': '風險案場',
  'total_projects': '總案場數',
  'average_progress': '平均進度',
  'average_overall_progress': '平均整體進度',
  'average_admin_progress': '平均行政進度',
  'average_engineering_progress': '平均工程進度',
  'in_review': '審查中',
  'show_canceled': '顯示已取消',
  'canceled': '已取消',
};

/**
 * Hook to get customizable UI labels
 * Falls back to default values if not configured in database
 */
export function useUILabels() {
  const { options, isLoading, getAllOptionsByCategory } = useCodebook();
  
  const uiLabelOptions = getAllOptionsByCategory('ui_labels');
  
  // Build a map from option values to labels
  const labelsMap: Record<string, string> = { ...defaultLabels };
  
  uiLabelOptions.forEach(option => {
    if (option.is_active) {
      labelsMap[option.value] = option.label;
    }
  });
  
  /**
   * Get a UI label by key
   * @param key - The label key (e.g., 'pending_documents')
   * @param fallback - Optional fallback value if key not found
   */
  const getLabel = (key: string, fallback?: string): string => {
    return labelsMap[key] || fallback || defaultLabels[key] || key;
  };
  
  return {
    getLabel,
    labelsMap,
    isLoading,
  };
}

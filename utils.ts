/**
 * Adds days to a date string and returns a new date string (YYYY-MM-DD)
 */
export const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const result = new Date(dateStr);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

export const getDaysRemaining = (deadlineStr: string): number => {
  const deadline = new Date(deadlineStr);
  const today = new Date();
  // Reset time to midnight for accurate day calculation
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diffTime = deadline.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};
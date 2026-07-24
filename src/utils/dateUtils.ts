/**
 * Utility functions for date and time in Brasilia Timezone (America/Sao_Paulo)
 */

export function getBrasiliaDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value;
    }
  }

  const year = partMap.year || '1970';
  const month = (partMap.month || '01').padStart(2, '0');
  const day = (partMap.day || '01').padStart(2, '0');
  let hour = (partMap.hour || '00').padStart(2, '0');
  if (hour === '24') hour = '00';
  const minute = (partMap.minute || '00').padStart(2, '0');
  const second = (partMap.second || '00').padStart(2, '0');

  const currentDate = `${year}-${month}-${day}`;
  const currentTime = `${hour}:${minute}:${second}`;
  const currentTimeShort = `${hour}:${minute}`;

  return { currentDate, currentTime, currentTimeShort, year, month, day, hour, minute, second };
}

export function getBrasiliaDateString(date: Date = new Date()): string {
  return getBrasiliaDateParts(date).currentDate;
}

export function getBrasiliaTimeString(date: Date = new Date(), includeSeconds: boolean = true): string {
  const parts = getBrasiliaDateParts(date);
  return includeSeconds ? parts.currentTime : parts.currentTimeShort;
}

export function getBrasiliaFormattedDateTime(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `${dateStr} às ${timeStr}`;
}

export function getBrasiliaFullString(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const timeStr = date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `${dateStr} ${timeStr}`;
}

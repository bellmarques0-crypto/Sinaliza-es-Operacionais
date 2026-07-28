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

export function calculateSLA(
  item: {
    data?: string;
    hora?: string;
    data_cadastro?: string;
    confirmado?: boolean;
    data_confirmacao?: string;
  },
  now: Date = new Date()
): { text: string; diffMins: number; status: 'pendente' | 'confirmado' | 'indefinido' } {
  const parseToUTC = (dStr?: string, tStr?: string): number | null => {
    try {
      if (!dStr) return null;
      let year = 1970, month = 1, day = 1;
      if (dStr.includes('/')) {
        const p = dStr.split('/');
        if (p[0].length === 4) {
          year = parseInt(p[0], 10);
          month = parseInt(p[1], 10);
          day = parseInt(p[2], 10);
        } else {
          day = parseInt(p[0], 10);
          month = parseInt(p[1], 10);
          year = parseInt(p[2], 10);
        }
      } else if (dStr.includes('-')) {
        const p = dStr.split('T')[0].split('-');
        if (p[0].length === 4) {
          year = parseInt(p[0], 10);
          month = parseInt(p[1], 10);
          day = parseInt(p[2], 10);
        } else {
          day = parseInt(p[0], 10);
          month = parseInt(p[1], 10);
          year = parseInt(p[2], 10);
        }
      } else {
        return null;
      }

      let h = 0, m = 0, s = 0;
      if (tStr) {
        const t = tStr.split(':');
        h = parseInt(t[0] || '0', 10);
        m = parseInt(t[1] || '0', 10);
        s = parseInt(t[2] || '0', 10);
      } else if (dStr.includes('T')) {
        const t = dStr.split('T')[1]?.replace('Z', '').split(':');
        if (t) {
          h = parseInt(t[0] || '0', 10);
          m = parseInt(t[1] || '0', 10);
          s = parseInt(t[2] || '0', 10);
        }
      }

      return Date.UTC(year, month - 1, day, h, m, s);
    } catch {
      return null;
    }
  };

  // 1. Data inicial
  let startMs = parseToUTC(item.data, item.hora);
  if (startMs === null && item.data_cadastro) {
    if (item.data_cadastro.includes('T')) {
      const d = new Date(item.data_cadastro);
      if (!isNaN(d.getTime())) {
        const parts = getBrasiliaDateParts(d);
        startMs = Date.UTC(
          parseInt(parts.year, 10),
          parseInt(parts.month, 10) - 1,
          parseInt(parts.day, 10),
          parseInt(parts.hour, 10),
          parseInt(parts.minute, 10),
          parseInt(parts.second, 10)
        );
      }
    } else {
      const parts = item.data_cadastro.split(' ');
      startMs = parseToUTC(parts[0], parts[1]);
    }
  }

  if (startMs === null) {
    return { text: '-', diffMins: 0, status: 'indefinido' };
  }

  // 2. Data final
  let endMs: number | null = null;
  if (item.confirmado && item.data_confirmacao) {
    const parts = item.data_confirmacao.split(' ');
    endMs = parseToUTC(parts[0], parts[1]);
  }

  const isConfirmed = item.confirmado && endMs !== null;
  if (!endMs) {
    const nowParts = getBrasiliaDateParts(now);
    endMs = Date.UTC(
      parseInt(nowParts.year, 10),
      parseInt(nowParts.month, 10) - 1,
      parseInt(nowParts.day, 10),
      parseInt(nowParts.hour, 10),
      parseInt(nowParts.minute, 10),
      parseInt(nowParts.second, 10)
    );
  }

  const diffMs = Math.max(0, endMs - startMs);
  const diffMins = Math.floor(diffMs / 60000);

  let formatStr = '';
  if (diffMins < 1) formatStr = '< 1m';
  else if (diffMins < 60) formatStr = `${diffMins}m`;
  else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) {
      formatStr = `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      formatStr = `${days}d${remHours > 0 ? ` ${remHours}h` : ''}`;
    }
  }

  return {
    text: formatStr,
    diffMins,
    status: isConfirmed ? 'confirmado' : 'pendente'
  };
}


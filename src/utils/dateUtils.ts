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

export function parseDateTimeToUTC(dStr?: string, tStr?: string): number | null {
  try {
    if (!dStr) return null;
    let cleanD = String(dStr).trim().replace(',', '');
    let cleanT = tStr ? String(tStr).trim().replace(',', '') : undefined;

    if (!cleanT && cleanD.includes(' ')) {
      const parts = cleanD.split(/\s+/);
      cleanD = parts[0];
      cleanT = parts[1];
    }
    let year = 1970, month = 1, day = 1;
    if (cleanD.includes('/')) {
      const p = cleanD.split('/');
      if (p[0].length === 4) {
        year = parseInt(p[0], 10);
        month = parseInt(p[1], 10);
        day = parseInt(p[2], 10);
      } else {
        day = parseInt(p[0], 10);
        month = parseInt(p[1], 10);
        year = parseInt(p[2], 10);
      }
    } else if (cleanD.includes('-')) {
      const p = cleanD.split('T')[0].split('-');
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
    if (cleanT) {
      const t = cleanT.split(':');
      h = parseInt(t[0] || '0', 10);
      m = parseInt(t[1] || '0', 10);
      s = parseInt(t[2] || '0', 10);
    } else if (cleanD.includes('T')) {
      const t = cleanD.split('T')[1]?.replace('Z', '').split(':');
      if (t) {
        h = parseInt(t[0] || '0', 10);
        m = parseInt(t[1] || '0', 10);
        s = parseInt(t[2] || '0', 10);
      }
    }

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(h) || isNaN(m) || isNaN(s)) {
      return null;
    }

    return Date.UTC(year, month - 1, day, h, m, s);
  } catch {
    return null;
  }
}

export function getSinalizacaoStartMs(item: {
  data?: string;
  hora?: string;
  data_cadastro?: string;
}): number | null {
  if (!item) return null;
  if (item.data) {
    const ts = parseDateTimeToUTC(item.data, item.hora);
    if (ts !== null) return ts;
  }
  if (item.data_cadastro) {
    if (item.data_cadastro.includes('T')) {
      const ts = parseDateTimeToUTC(item.data_cadastro);
      if (ts !== null) return ts;
      const d = new Date(item.data_cadastro);
      if (!isNaN(d.getTime())) return d.getTime();
    } else {
      const ts = parseDateTimeToUTC(item.data_cadastro);
      if (ts !== null) return ts;
    }
  }
  return null;
}

export function getSinalizacaoEndMs(item: {
  data_confirmacao?: string;
}): number | null {
  if (!item || !item.data_confirmacao) return null;
  return parseDateTimeToUTC(item.data_confirmacao);
}

export function formatTempoMedioDisplay(diffMins: number): string {
  if (!diffMins || diffMins <= 0) return '0min';
  if (diffMins < 60) return `${diffMins}min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
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
  const startMs = getSinalizacaoStartMs(item);
  if (startMs === null) {
    return { text: '-', diffMins: 0, status: 'indefinido' };
  }

  let endMs = getSinalizacaoEndMs(item);
  const isConfirmed = !!(
    item.confirmado === true ||
    String(item.confirmado) === 'true' ||
    (item.confirmado as unknown) === 1 ||
    item.data_confirmacao
  ) && endMs !== null;

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

export function isSupervisorMatch(userNome: string, userLogin: string, supervisor: string): boolean {
  if (!supervisor) return false;

  const clean = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/z/g, 's')
      .replace(/\b(supervisor|supervisora|sup|coordenador|coordenadora|coord|gerente)\b/g, '')
      .trim();

  const normUser = clean(userNome);
  const normLogin = clean(userLogin);
  const normSup = clean(supervisor);

  if (!normSup) return false;

  // 1. Direct exact name/login match
  if (normUser === normSup || normLogin === normSup) return true;

  // 2. Full substring match if both have reasonable length (e.g. "rodrigo bueno" in "rodrigo bueno silva")
  if (normUser.length >= 5 && normSup.length >= 5) {
    if (normUser.includes(normSup) || normSup.includes(normUser)) return true;
  }

  // 3. Rodrigo Bueno & Larissa Michaely cross-access: Both see and manage each other's operators
  const isUserRodrigoOrLarissa =
    normUser.includes('rodrigo') || normLogin.includes('rodrigo') ||
    normUser.includes('larissa') || normLogin.includes('larissa');

  if (isUserRodrigoOrLarissa) {
    const isSupRodrigoOrLarissa =
      normSup.includes('rodrigo') || normSup.includes('larissa') ||
      normSup.includes('bueno') || normSup.includes('michaely');
    if (isSupRodrigoOrLarissa) return true;
  }

  // 4. Lorena access rule: Lorena sees and manages signalizations/operators for Camily and Alaide
  const isUserLorena = normUser.includes('lorena') || normLogin.includes('lorena');

  if (isUserLorena) {
    const isTargetSupCamilyOrAlaide =
      normSup.includes('camily') || normSup.includes('alaide') || normSup.includes('alaíde');
    if (isTargetSupCamilyOrAlaide) return true;
  }

  // 4. Token matching
  const stopWords = new Set(['dos', 'das', 'da', 'de', 'do', 'e']);
  const userTokens = normUser.split(/\s+/).filter((t) => t.length > 1 && !stopWords.has(t));
  const supTokens = normSup.split(/\s+/).filter((t) => t.length > 1 && !stopWords.has(t));

  if (userTokens.length === 0 || supTokens.length === 0) return false;

  // Primary first name matching logic
  const compoundPrefixes = new Set(['ana', 'maria', 'joao', 'pedro', 'carlos', 'luiz', 'paulo', 'jose']);

  const userFirst = userTokens[0];
  const supFirst = supTokens[0];

  // Check if first names match
  let firstNameMatches = (userFirst === supFirst);

  if (!firstNameMatches && compoundPrefixes.has(userFirst) && userTokens.length > 1) {
    if (userTokens[1] === supFirst) firstNameMatches = true;
  }
  if (!firstNameMatches && compoundPrefixes.has(supFirst) && supTokens.length > 1) {
    if (userFirst === supTokens[1]) firstNameMatches = true;
  }

  if (!firstNameMatches) {
    // If first names don't match, check login match if login is provided
    if (normLogin && normLogin.length >= 4) {
      const loginTokens = normLogin.split(/[\s._-]+/).filter((t) => t.length > 1 && !stopWords.has(t));
      if (loginTokens.length > 0 && loginTokens[0] === supFirst) {
        firstNameMatches = true;
      }
    }
  }

  if (!firstNameMatches) return false;

  // First name matches. Now check if remaining name tokens (surnames) have overlap or match.
  // If one of the names has only 1 token (just the first name), first name match is enough.
  if (userTokens.length === 1 || supTokens.length === 1) return true;

  const userSurnames = userTokens.slice(1);
  const supSurnames = supTokens.slice(1);

  const sharedSurnames = userSurnames.filter((t) => supSurnames.includes(t));
  return sharedSurnames.length >= 1;
}


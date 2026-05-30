function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getBaseHolidayName(date: Date): string | null {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = date.getDay();
  if (m === 1 && d === 1) return "元日";
  if (m === 2 && d === 11) return "建国記念日";
  if (m === 2 && d === 23) return "天皇誕生日";
  if (m === 3 && d === vernalEquinox(y)) return "春分の日";
  if (m === 4 && d === 29) return "昭和の日";
  if (m === 5 && d === 3) return "憲法記念日";
  if (m === 5 && d === 4) return "みどりの日";
  if (m === 5 && d === 5) return "こどもの日";
  if (m === 8 && d === 11) return "山の日";
  if (m === 9 && d === autumnalEquinox(y)) return "秋分の日";
  if (m === 11 && d === 3) return "文化の日";
  if (m === 11 && d === 23) return "勤労感謝の日";
  if (m === 1 && dow === 1 && d === nthWeekday(y, 0, 1, 2)) return "成人の日";
  if (m === 7 && dow === 1 && d === nthWeekday(y, 6, 1, 3)) return "海の日";
  if (m === 9 && dow === 1 && d === nthWeekday(y, 8, 1, 3)) return "敬老の日";
  if (m === 10 && dow === 1 && d === nthWeekday(y, 9, 1, 2)) return "スポーツの日";
  return null;
}

export function getJapaneseHolidayName(date: Date): string | null {
  const base = getBaseHolidayName(date);
  if (base) return base;
  const dow = date.getDay();
  // 振替休日: Monday after Sunday holiday
  if (dow === 1) {
    const sun = new Date(date); sun.setDate(sun.getDate() - 1);
    if (getBaseHolidayName(sun)) return "振替休日";
  }
  // 振替休日: cascading (Sun+Mon both holidays → Tue)
  if (dow === 2) {
    const sun = new Date(date); sun.setDate(sun.getDate() - 2);
    const mon = new Date(date); mon.setDate(mon.getDate() - 1);
    if (getBaseHolidayName(sun) && getBaseHolidayName(mon)) return "振替休日";
  }
  // 国民の休日: weekday sandwiched between two holidays
  if (dow !== 0 && dow !== 6) {
    const prev = new Date(date); prev.setDate(prev.getDate() - 1);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    if (getBaseHolidayName(prev) && getBaseHolidayName(next)) return "国民の休日";
  }
  return null;
}

export function isJapaneseHoliday(date: Date): boolean {
  return getJapaneseHolidayName(date) !== null;
}

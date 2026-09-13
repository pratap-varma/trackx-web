/**
 * TrackX Academic & Public Holidays Engine
 * Automatically designates Sundays and official Public / Gazetted Holidays
 * for colleges and academic institutions.
 */

export interface HolidayInfo {
  isHoliday: boolean;
  name?: string;
  type: "sunday" | "saturday" | "public_holiday" | "custom_override" | "none";
}

// Fixed-date recurring annual public holidays (MM-DD)
export const FIXED_ANNUAL_HOLIDAYS: Record<string, string> = {
  "01-01": "New Year's Day",
  "01-14": "Makar Sankranti / Pongal",
  "01-15": "Pongal / Kanuma",
  "01-26": "Republic Day",
  "04-14": "Dr. B.R. Ambedkar Jayanti",
  "05-01": "May Day / International Labour Day",
  "08-15": "Independence Day",
  "10-02": "Mahatma Gandhi Jayanti",
  "12-25": "Christmas Day",
  "12-26": "Boxing Day",
};

// Variable / Lunisolar Public Holidays for 2025, 2026, 2027 (YYYY-MM-DD)
export const VARIABLE_PUBLIC_HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-02-26": "Maha Shivaratri",
  "2025-03-14": "Holi",
  "2025-03-30": "Ugadi / Telugu New Year",
  "2025-03-31": "Eid ul-Fitr (Ramzan)",
  "2025-04-10": "Mahavir Jayanti",
  "2025-04-18": "Good Friday",
  "2025-05-12": "Buddha Purnima",
  "2025-06-07": "Eid al-Adha (Bakrid)",
  "2025-07-06": "Muharram",
  "2025-08-27": "Ganesh Chaturthi",
  "2025-09-05": "Milad-un-Nabi",
  "2025-10-01": "Maha Navami",
  "2025-10-02": "Vijayadashami / Dussehra",
  "2025-10-20": "Deepavali / Diwali",
  "2025-11-05": "Guru Nanak Jayanti",

  // 2026
  "2026-02-15": "Maha Shivaratri",
  "2026-03-04": "Holi",
  "2026-03-19": "Ugadi / Telugu New Year",
  "2026-03-21": "Eid ul-Fitr",
  "2026-03-31": "Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-05-01": "Buddha Purnima",
  "2026-05-27": "Eid al-Adha (Bakrid)",
  "2026-06-25": "Muharram",
  "2026-08-16": "Janmashtami",
  "2026-09-14": "Ganesh Chaturthi",
  "2026-09-25": "Milad-un-Nabi",
  "2026-10-19": "Maha Navami",
  "2026-10-20": "Vijayadashami / Dussehra",
  "2026-11-08": "Deepavali / Diwali",
  "2026-11-24": "Guru Nanak Jayanti",

  // 2027
  "2027-03-06": "Maha Shivaratri",
  "2027-03-10": "Eid ul-Fitr",
  "2027-03-23": "Holi",
  "2027-03-26": "Good Friday",
  "2027-04-08": "Ugadi",
  "2027-04-19": "Mahavir Jayanti",
  "2027-05-16": "Eid al-Adha (Bakrid)",
  "2027-05-20": "Buddha Purnima",
  "2027-06-15": "Muharram",
  "2027-09-04": "Ganesh Chaturthi",
  "2027-10-09": "Dussehra / Vijayadashami",
  "2027-10-29": "Deepavali / Diwali",
  "2027-11-13": "Guru Nanak Jayanti",
};

/**
 * Normalizes any Date or string to YYYY-MM-DD
 */
export function toDateKey(date: Date | string): string {
  if (typeof date === "string") {
    // If already in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return date.slice(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Checks if a given date is Sunday or an official Public Holiday
 */
export function getHolidayInfo(
  dateInput: Date | string,
  customOverrides?: Record<string, boolean>
): HolidayInfo {
  const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const dateKey = toDateKey(dateInput);

  // 1. Explicit user toggle override takes highest priority (e.g. compensatory working day or custom holiday)
  if (customOverrides && customOverrides[dateKey] !== undefined) {
    if (customOverrides[dateKey] === true) {
      return {
        isHoliday: true,
        name: "College Holiday (Custom)",
        type: "custom_override",
      };
    } else {
      // Explicitly marked as a working day
      return {
        isHoliday: false,
        type: "none",
      };
    }
  }

  // 2. Sunday is a universal holiday for all colleges
  if (!isNaN(dateObj.getTime()) && dateObj.getDay() === 0) {
    return {
      isHoliday: true,
      name: "Sunday (Weekend Holiday)",
      type: "sunday",
    };
  }

  // 3. Saturday is generally also a weekend holiday for colleges
  if (!isNaN(dateObj.getTime()) && dateObj.getDay() === 6) {
    return {
      isHoliday: true,
      name: "Saturday (Weekend Holiday)",
      type: "saturday",
    };
  }

  // 3. Check variable annual public holidays (YYYY-MM-DD)
  if (VARIABLE_PUBLIC_HOLIDAYS[dateKey]) {
    return {
      isHoliday: true,
      name: VARIABLE_PUBLIC_HOLIDAYS[dateKey],
      type: "public_holiday",
    };
  }

  // 4. Check fixed annual public holidays (MM-DD)
  const monthDay = dateKey.slice(5); // "MM-DD"
  if (FIXED_ANNUAL_HOLIDAYS[monthDay]) {
    return {
      isHoliday: true,
      name: FIXED_ANNUAL_HOLIDAYS[monthDay],
      type: "public_holiday",
    };
  }

  return {
    isHoliday: false,
    type: "none",
  };
}

/**
 * Quick boolean check: is this date a holiday (Sunday, Public Holiday, or custom override)?
 */
export function isDayHoliday(
  dateInput: Date | string,
  customOverrides?: Record<string, boolean>
): boolean {
  return getHolidayInfo(dateInput, customOverrides).isHoliday;
}

export interface PublicHolidayItem {
  dateKey: string;
  name: string;
  dayOfWeek: string;
  isSunday: boolean;
}

/**
 * Returns all recognized public holidays for a given year sorted chronologically.
 */
export function getPublicHolidaysList(year: number = new Date().getFullYear()): PublicHolidayItem[] {
  const list: PublicHolidayItem[] = [];
  const seenDates = new Set<string>();

  // 1. Fixed annual holidays
  for (const [mmdd, name] of Object.entries(FIXED_ANNUAL_HOLIDAYS)) {
    const dateKey = `${year}-${mmdd}`;
    const d = new Date(`${dateKey}T00:00:00`);
    if (!isNaN(d.getTime())) {
      list.push({
        dateKey,
        name,
        dayOfWeek: d.toLocaleDateString("en-US", { weekday: "short" }),
        isSunday: d.getDay() === 0,
      });
      seenDates.add(dateKey);
    }
  }

  // 2. Variable public holidays for this year
  for (const [dateKey, name] of Object.entries(VARIABLE_PUBLIC_HOLIDAYS)) {
    if (dateKey.startsWith(`${year}-`) && !seenDates.has(dateKey)) {
      const d = new Date(`${dateKey}T00:00:00`);
      if (!isNaN(d.getTime())) {
        list.push({
          dateKey,
          name,
          dayOfWeek: d.toLocaleDateString("en-US", { weekday: "short" }),
          isSunday: d.getDay() === 0,
        });
        seenDates.add(dateKey);
      }
    }
  }

  return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

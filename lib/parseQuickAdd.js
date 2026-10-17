import { toISODateLocal } from "./dates";

// Reads a date (and, for events, a time) typed in plain words in the Add bar,
// e.g. "Dentist fri 3pm", "Pay rent on the 1st", "Call mom tomorrow".
// Returns { title, date, startTime, endTime, phrase, phrases }: the title with
// the date and time words taken out, YYYY-MM-DD / "HH:MM" (or null), and the
// words that were understood: joined for the preview, and one by one (as typed)
// for highlighting. Nothing understood -> date null.

// "sun" and "sat" are left out on purpose: "sun cream", "SAT prep".
const WEEKDAYS = {
  sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  saturday: 6,
};

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const WEEKDAY_RE = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const ORD = "(?:st|nd|rd|th)";
const LEAD = "(?:(?:on|by|due|for)\\s+)?";

function addDays(now, n) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
}

// A real calendar date (rejects e.g. Feb 30).
function validDate(year, month, day) {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? d : null;
}

// A month and day with no year: this year, or next year if it has passed.
function upcomingMonthDay(now, month, day) {
  const today = addDays(now, 0);
  const thisYear = validDate(now.getFullYear(), month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return validDate(now.getFullYear() + 1, month, day);
}

// Date rules, tried in order. Each returns a Date or null from its match.
const DATE_RULES = [
  { re: new RegExp(`\\b${LEAD}(today|tonight)\\b`, "i"), date: (m, now) => addDays(now, 0) },
  { re: new RegExp(`\\b${LEAD}(tomorrow|tmrw|tmr)\\b`, "i"), date: (m, now) => addDays(now, 1) },
  {
    re: /\bnext\s+week\b/i,
    date: (m, now) => addDays(now, ((8 - now.getDay()) % 7) || 7),
  },
  {
    re: /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks|month|months)\b/i,
    date: (m, now) => {
      const n = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
      const unit = m[2].toLowerCase();
      if (unit.startsWith("day")) return addDays(now, n);
      if (unit.startsWith("week")) return addDays(now, n * 7);
      return new Date(now.getFullYear(), now.getMonth() + n, now.getDate());
    },
  },
  {
    // "fri", "next friday", "on tue" (the coming one; today counts)
    re: new RegExp(`\\b${LEAD}(next\\s+)?(${WEEKDAY_RE})\\b\\.?`, "i"),
    date: (m, now) => {
      const ahead = (WEEKDAYS[m[2].toLowerCase()] - now.getDay() + 7) % 7;
      return addDays(now, ahead + (m[1] ? 7 : 0));
    },
  },
  {
    // "oct 20", "October 20th", "oct 20, 2027"
    re: new RegExp(`\\b${LEAD}(${MONTH_RE})\\.?\\s+(\\d{1,2})${ORD}?(?:,?\\s+(\\d{4}))?\\b`, "i"),
    date: (m, now) => {
      const month = MONTHS[m[1].toLowerCase()];
      const day = Number(m[2]);
      return m[3] ? validDate(Number(m[3]), month, day) : upcomingMonthDay(now, month, day);
    },
  },
  {
    // "20 oct", "20th of October"
    re: new RegExp(`\\b${LEAD}(\\d{1,2})${ORD}?\\s+(?:of\\s+)?(${MONTH_RE})\\b\\.?`, "i"),
    date: (m, now) => upcomingMonthDay(now, MONTHS[m[2].toLowerCase()], Number(m[1])),
  },
  {
    // "10/20", "10/20/2027" (month/day)
    re: new RegExp(`\\b${LEAD}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?\\b`, "i"),
    date: (m, now) => {
      const month = Number(m[1]) - 1;
      const day = Number(m[2]);
      if (!m[3]) return upcomingMonthDay(now, month, day);
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return validDate(year, month, day);
    },
  },
  {
    // "the 1st", "on the 20th", "20th": this month, or next month if it has passed
    re: new RegExp(`\\b${LEAD}(?:the\\s+)?(\\d{1,2})${ORD}\\b`, "i"),
    date: (m, now) => {
      const day = Number(m[1]);
      const today = addDays(now, 0);
      for (let i = 0; i < 3; i++) {
        const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const d = validDate(month.getFullYear(), month.getMonth(), day);
        if (d && d >= today) return d;
      }
      return null;
    },
  },
];

const pad = (n) => String(n).padStart(2, "0");

// "3", "15", with optional minutes and am/pm -> "HH:MM" (or null if impossible).
function toTime(hourStr, minStr, meridiem, assumePm) {
  let hour = Number(hourStr);
  const min = minStr ? Number(minStr) : 0;
  if (min > 59) return null;
  const mer = meridiem ? meridiem.toLowerCase()[0] : null;
  if (mer) {
    if (hour < 1 || hour > 12) return null;
    if (mer === "p" && hour !== 12) hour += 12;
    if (mer === "a" && hour === 12) hour = 0;
  } else if (assumePm && hour >= 1 && hour <= 7) {
    hour += 12;
  }
  if (hour > 23) return null;
  return `${pad(hour)}:${pad(min)}`;
}

const MER = "(a\\.?m\\.?|p\\.?m\\.?|am|pm|a|p)";
const TIME_RULES = [
  {
    // "3-4pm", "3pm - 4:30pm", "10:30 to 11am"
    re: new RegExp(`\\b(?:at\\s+|from\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*${MER}?\\s*(?:-|–|to)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*${MER}(?![a-z])`, "i"),
    time: (m) => {
      const endMer = m[6];
      const end = toTime(m[4], m[5], endMer);
      // "3-4pm": the start shares the end's am/pm unless that would put it after the end.
      let start = toTime(m[1], m[2], m[3] || endMer);
      if (!m[3] && start && end && start > end) start = toTime(m[1], m[2], endMer.toLowerCase()[0] === "p" ? "a" : "p");
      return start && end ? { startTime: start, endTime: end } : null;
    },
  },
  {
    re: new RegExp(`\\b(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*${MER}(?![a-z])`, "i"),
    time: (m) => {
      const t = toTime(m[1], m[2], m[3]);
      return t ? { startTime: t } : null;
    },
  },
  { re: /\b(?:at\s+)?noon\b/i, time: () => ({ startTime: "12:00" }) },
  { re: /\b(?:at\s+)?midnight\b/i, time: () => ({ startTime: "00:00" }) },
  {
    // 24-hour "15:30" (needs the colon)
    re: /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i,
    time: (m) => ({ startTime: `${pad(Number(m[1]))}:${m[2]}` }),
  },
  {
    // "at 3": 1-7 means afternoon, 8-12 morning/noon
    re: /\bat\s+(\d{1,2})\b(?!\s*(?:\/|:|st|nd|rd|th))/i,
    time: (m) => {
      const t = toTime(m[1], null, null, true);
      return t ? { startTime: t } : null;
    },
  },
];

function cut(text, match) {
  return (text.slice(0, match.index) + " " + text.slice(match.index + match[0].length)).replace(/\s+/g, " ").trim();
}

export function parseQuickAdd(text, { now = new Date(), withTime = false } = {}) {
  let title = text;
  const phrases = [];
  let startTime = null;
  let endTime = null;

  if (withTime) {
    for (const rule of TIME_RULES) {
      const m = title.match(rule.re);
      if (!m) continue;
      const found = rule.time(m);
      if (!found) continue;
      startTime = found.startTime;
      endTime = found.endTime || null;
      phrases.push(m[0].trim());
      title = cut(title, m);
      break;
    }
  }

  let date = null;
  for (const rule of DATE_RULES) {
    const m = title.match(rule.re);
    if (!m) continue;
    const d = rule.date(m, now);
    if (!d) continue;
    date = toISODateLocal(d);
    phrases.unshift(m[0].trim());
    title = cut(title, m);
    break;
  }

  // Keep the original text if the words were all there was.
  if (!title) return { title: text.trim(), date: null, startTime: null, endTime: null, phrase: "", phrases: [] };
  return { title, date, startTime, endTime, phrase: phrases.join(" "), phrases };
}

/**
 * ics-parser.js — BEE FieldKIT
 *
 * Parses an .ics (iCalendar) file exported from Outlook / Microsoft 365
 * and returns a normalized calendar object compatible with FieldKIT's
 * internal format:
 *
 *   { last_sync: ISO string, events: [{ id, title, start, end, location, linked_project_id }] }
 *
 * Preserves any existing linked_project_id values by UID when merging
 * with previously stored events.
 */

// Storage key shared with ui-project-catalog.js
export const LS_CALENDAR = "fieldkit_calendar";

// ------------------------------------------------------------------
// ICS LINE PARSING HELPERS
// ------------------------------------------------------------------

/**
 * Unfold continuation lines (RFC 5545 §3.1).
 * A logical line may be split by inserting CRLF followed by a single
 * whitespace character.  Remove those folding points.
 */
function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

/**
 * Parse a single unfolded ICS content line into { name, params, value }.
 * e.g.  DTSTART;TZID=America/New_York:20261010T080000
 *        → { name: "DTSTART", params: { TZID: "America/New_York" }, value: "20261010T080000" }
 */
function parseLine(line) {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return { name: line, params: {}, value: "" };

  const namePart = line.slice(0, colonIdx);
  const value    = line.slice(colonIdx + 1);

  const parts = namePart.split(";");
  const name  = parts[0].toUpperCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split("=");
    if (k) params[k.toUpperCase()] = v || "";
  }
  return { name, params, value };
}

/**
 * Convert an iCal date/datetime string to an ISO 8601 string.
 * Handles:
 *   20261010          → 2026-10-10          (all-day date)
 *   20261010T080000Z  → 2026-10-10T08:00:00Z (UTC)
 *   20261010T080000   → 2026-10-10T08:00:00  (floating / local)
 */
function toIso(icsDate) {
  if (!icsDate) return "";
  // Strip any trailing Z for processing, remember if present
  const isUtc = icsDate.endsWith("Z");
  const d = icsDate.replace("Z", "");

  if (d.includes("T")) {
    // datetime: YYYYMMDDTHHmmss
    const year = d.slice(0, 4);
    const mon  = d.slice(4, 6);
    const day  = d.slice(6, 8);
    const hh   = d.slice(9, 11);
    const mm   = d.slice(11, 13);
    const ss   = d.slice(13, 15) || "00";
    return `${year}-${mon}-${day}T${hh}:${mm}:${ss}${isUtc ? "Z" : ""}`;
  } else {
    // date only: YYYYMMDD
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
}

// ------------------------------------------------------------------
// MAIN PARSER
// ------------------------------------------------------------------

/**
 * Parse the text content of an .ics file.
 * Returns an array of normalized event objects.
 */
export function parseIcs(text) {
  const lines  = unfold(text).split(/\r?\n/);
  const events = [];
  let current  = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (current) {
        const ev = buildEvent(current);
        if (ev) events.push(ev);
      }
      current = null;
      continue;
    }

    if (current) {
      const { name, value } = parseLine(trimmed);
      // Keep only the first occurrence of each property (RFC allows repeats for RDATE etc.)
      if (!(name in current)) {
        current[name] = { raw: trimmed, value };
      }
    }
  }

  return events;
}

function buildEvent(props) {
  const get = key => props[key]?.value ?? "";

  const start = toIso(get("DTSTART"));
  const end   = toIso(get("DTEND"));
  const uid   = get("UID");

  if (!start || !uid) return null;

  // Unescape iCal text encoding: \n → newline, \, → comma, \\ → backslash
  const unescape = str => str
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g,  ",")
    .replace(/\\;/g,  ";")
    .replace(/\\\\/g, "\\");

  // Normalize common template headings so downstream renderers can
  // consistently detect sections from either DESCRIPTION or X-ALT-DESC.
  const normalizeDescription = text => {
    const normalized = String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ");

    const lines = normalized.split("\n").map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      return trimmed
        .replace(/^(?:on\s*site|onsite)\s+contact\s*[-:–—]\s*/i, "Contact- ")
        .replace(/^contact\s*[-:–—]\s*/i, "Contact- ");
    });

    const compact = [];
    let previousBlank = false;
    for (const line of lines) {
      if (!line) {
        if (!previousBlank) compact.push("");
        previousBlank = true;
        continue;
      }
      compact.push(line);
      previousBlank = false;
    }

    return compact.join("\n").trim();
  };

  // Outlook desktop exports the event body as HTML in X-ALT-DESC;FMTTYPE=text/html
  // and leaves DESCRIPTION empty.  Strip the HTML to get readable plain text.
  const stripHtml = html => {
    // Remove <style> and <head> blocks entirely
    let t = html.replace(/<(style|head)[^>]*>[\s\S]*?<\/\1>/gi, "");
    // Replace block-level closing tags with newlines
    t = t.replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n");
    t = t.replace(/<br\s*\/?>/gi, "\n");
    // Strip remaining tags
    t = t.replace(/<[^>]+>/g, "");
    // Decode common HTML entities
    t = t.replace(/&nbsp;/gi, " ")
         .replace(/&amp;/gi,  "&")
         .replace(/&lt;/gi,   "<")
         .replace(/&gt;/gi,   ">")
         .replace(/&quot;/gi, "\"")
         .replace(/&#39;/gi,  "'");

    // Outlook wraps intentional blank lines in <p>&nbsp;</p>, so after stripping
    // tags those lines contain only whitespace — not empty strings.
    // Step 1: trim every line so whitespace-only lines become truly empty.
    const lines = t.split("\n").map(l => l.trim());

    // Step 2: collapse runs of blank lines using the Outlook N→N-1 rule.
    // Each run of N consecutive blank lines becomes max(0, N-1) blank lines.
    // Result: 1 blank line (Outlook artifact) → 0, 2 blank lines → 1, etc.
    const out = [];
    let blanks = 0;
    for (const line of lines) {
      if (line === "") {
        blanks++;
      } else {
        const keep = Math.max(0, blanks - 1);
        for (let i = 0; i < keep; i++) out.push("");
        out.push(line);
        blanks = 0;
      }
    }

    return out.join("\n").trim();
  };

  // Priority: DESCRIPTION (plain text) → X-ALT-DESC (HTML, strip tags) → empty
  let description = unescape(get("DESCRIPTION"));
  if (!description) {
    const altDesc = get("X-ALT-DESC");
    if (altDesc) {
      description = stripHtml(altDesc);
      console.debug("[ics-parser] Used X-ALT-DESC for", get("SUMMARY"));
    }
  }
  description = normalizeDescription(description);

  return {
    id:                uid,
    title:             get("SUMMARY")  || "Scheduled Visit",
    start,
    end:               end || start,
    location:          get("LOCATION") || "",
    description,
    linked_project_id: null   // populated during merge
  };
}

// ------------------------------------------------------------------
// MERGE + PERSIST
// ------------------------------------------------------------------

/**
 * Import events from an ICS text string.
 * Merges with any previously stored calendar data, preserving
 * existing linked_project_id values for events with matching UIDs.
 *
 * Returns the merged calendar object that was saved to localStorage.
 */
export function importIcsToStorage(icsText) {
  const incoming = parseIcs(icsText);

  // Load existing stored calendar to preserve linked_project_id
  let existing = [];
  try {
    const stored = localStorage.getItem(LS_CALENDAR);
    if (stored) {
      const parsed = JSON.parse(stored);
      existing = Array.isArray(parsed?.events) ? parsed.events : [];
    }
  } catch (_) { /* ignore */ }

  // Build a lookup of existing linked_project_ids by event id
  const linkedById = {};
  for (const ev of existing) {
    if (ev.linked_project_id) linkedById[ev.id] = ev.linked_project_id;
  }

  // Apply preserved links to incoming events
  for (const ev of incoming) {
    if (linkedById[ev.id]) {
      ev.linked_project_id = linkedById[ev.id];
    }
  }

  const calendar = {
    last_sync: new Date().toISOString(),
    source:    "ics",
    events:    incoming
  };

  localStorage.setItem(LS_CALENDAR, JSON.stringify(calendar));
  return calendar;
}

/**
 * Fetch an ICS file from a URL and import it into localStorage.
 * Uses no-store so scheduled file updates are reflected immediately.
 */
export async function importIcsUrlToStorage(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ICS: ${url}`);
  }

  const text = await res.text();
  return importIcsToStorage(text);
}

/**
 * Load the stored calendar from localStorage.
 * Returns null if nothing is stored yet.
 */
export function loadStoredCalendar() {
  try {
    const stored = localStorage.getItem(LS_CALENDAR);
    return stored ? JSON.parse(stored) : null;
  } catch (_) {
    return null;
  }
}

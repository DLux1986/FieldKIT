/**
 * ui-dashboard.js — BEE FieldKIT
 * Renders the weekly Testing Schedule on the dashboard.
 * Loads calendar data from the shared ICS file when available and
 * shows the active source + last sync status in the schedule header.
 */

import { loadCalendar } from "./ui-project-catalog.js";
import { loadProjects, saveProjectAddressOverride } from "./projects.js";

// ------------------------------------------------------------------
// DATE HELPERS
// ------------------------------------------------------------------

/** Return the Monday of the week containing `date`. */
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Return an array of 7 Date objects for Mon–Sun of the week containing `date`. */
function weekDays(date) {
  const mon = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

/** Format a Date as "Mon 7/7" */
function fmtDayHeader(date) {
  return date.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
}

/** Format a datetime ISO string as "8:00 AM" */
function fmtTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  // All-day events have no time component — detect by checking if the string
  // contains a 'T' character.
  if (!isoStr.includes("T")) return "All day";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** True if two dates fall on the same calendar day. */
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// ------------------------------------------------------------------
// RENDER
// ------------------------------------------------------------------

function renderWeekSchedule(calendar) {
  _calendar = calendar;
  const events = calendar?.events ?? [];
  _allEvents = events;
  const section = document.getElementById("week-schedule");
  if (!section) return;

  const today = new Date();
  const days  = weekDays(today);

  // Index events by day
  const byDay = new Map();
  for (const day of days) byDay.set(day.toDateString(), []);

  for (const ev of events) {
    if (!ev.start) continue;
    const evDate = new Date(ev.start);
    const key    = evDate.toDateString();
    if (byDay.has(key)) byDay.get(key).push(ev);
  }

  // Sort events within each day by start time
  for (const [, list] of byDay) {
    list.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  // Build header row + event columns
  const cols = days.map(day => {
    const isToday   = sameDay(day, today);
    const dayEvents = byDay.get(day.toDateString()) || [];

    const eventHtml = dayEvents.length
      ? dayEvents.map(ev => `
          <button class="week-event${ev.linked_project_id ? " week-event--linked" : ""}"
                  data-event-id="${encodeURIComponent(ev.id)}"
                  type="button">
            <div class="week-event-time">${fmtTime(ev.start)}</div>
            <div class="week-event-title">${ev.title}</div>
            ${ev.location ? `<div class="week-event-location">${cleanAddress(ev.location)}</div>` : ""}
            ${ev.linked_project_id
              ? `<div class="week-event-project">${ev.linked_project_id}</div>`
              : ""}
          </button>`).join("")
      : `<div class="week-no-events">—</div>`;

    return `
      <div class="week-col${isToday ? " week-col--today" : ""}">
        <div class="week-col-header">
          ${fmtDayHeader(day)}
          ${isToday ? '<span class="week-today-badge">Today</span>' : ""}
        </div>
        <div class="week-col-events">${eventHtml}</div>
      </div>`;
  }).join("");

  const sourceLabel = calendar?.source_label || "Calendar";
  const sourceClass =
    calendar?.source === "ics-file"
      ? "schedule-sync-badge--ok"
      : calendar?.source === "local-storage"
        ? "schedule-sync-badge--warn"
        : "schedule-sync-badge--legacy";

  const syncTime = (() => {
    const iso = calendar?.last_sync;
    if (!iso) return "Sync time unavailable";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Sync time unavailable";
    return `Updated ${d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  })();

  section.innerHTML = `
    <div class="schedule-section-header">
      <h2>Testing Schedule</h2>
      <div class="schedule-header-meta">
        <span class="schedule-week-label">${fmtWeekLabel(days[0], days[6])}</span>
        <span class="schedule-sync-badge ${sourceClass}">${sourceLabel}</span>
        <span class="schedule-sync-time">${syncTime}</span>
      </div>
    </div>
    <div class="week-grid">${cols}</div>`;
}

function fmtWeekLabel(mon, sun) {
  const opts = { month: "short", day: "numeric" };
  return `${mon.toLocaleDateString([], opts)} – ${sun.toLocaleDateString([], opts)}`;
}

// ------------------------------------------------------------------
// EVENT DETAIL MODAL
// ------------------------------------------------------------------

/** Parse and clean Outlook's messy address format.
 * Input: "12730 NE 124th St (12730 NE 124th St\, Kirkland\, Washington 98034)"
 * Output: "12730 NE 124th St, Kirkland, Washington 98034"
 */
function cleanAddress(addr) {
  if (!addr) return "";
  
  // Extract content from parentheses if present
  const match = addr.match(/\(([^)]+)\)/);
  let cleaned = match ? match[1] : addr;
  
  // Remove backslashes added by Outlook
  cleaned = cleaned.replace(/\\/g, "");
  
  return cleaned.trim();
}

/** Format address as a clickable Google Maps link. */
function formatAddressLink(addr) {
  const cleaned = cleanAddress(addr);
  if (!cleaned) return "";
  
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(cleaned)}`;
  return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:white;text-decoration:underline;cursor:pointer;font-weight:600;">${cleaned} 🗺</a>`;
}

/** Linkify phone numbers in text: (123) 456-7890 → <a href="tel:..."> */
function linkifyPhoneNumbers(text) {
  // Match common phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  const phoneRegex = /(\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4}))/g;
  
  return text.replace(phoneRegex, match => {
    // Extract just the digits
    const digits = match.replace(/\D/g, "");
    // Format for tel: link (must be digits, optional leading +1)
    const telLink = digits.length === 10 ? `1${digits}` : digits;
    return `<a href="tel:+${telLink}" style="color:inherit;text-decoration:underline;cursor:pointer;font-weight:600;">${match}</a>`;
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTemplateDescriptionHtml(description) {
  const raw = String(description || "");
  const normalized = raw.replace(/\r\n?/g, "\n");
  const headingRegex = /(Attendees|Scope|Note|Contact)\s*[-:]/gi;

  const matches = Array.from(normalized.matchAll(headingRegex));
  if (matches.length < 2) return null;

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const next = matches[i + 1];
    const start = (match.index ?? 0) + match[0].length;
    const end = next ? (next.index ?? normalized.length) : normalized.length;

    const heading = match[1].toUpperCase();
    const sectionText = normalized
      .slice(start, end)
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    sections.push({ heading, text: sectionText });
  }

  if (!sections.length) return null;

  const html = sections
    .map(section => {
      const content = section.text ? linkifyPhoneNumbers(escapeHtml(section.text)) : "";
      return `<strong>${section.heading}</strong><br><br>${content}`;
    })
    .join("<br><br>");

  return html;
}

let _allEvents = [];
let _currentEventId = null;
let _calendar = null;
let _projectSelectorProjects = [];

function openEventDetail(eventId) {
  const ev = _allEvents.find(e => e.id === eventId);
  if (!ev) return;

  const overlay   = document.getElementById("event-detail-overlay");
  const titleEl   = document.getElementById("event-detail-title");
  const metaEl    = document.getElementById("event-detail-meta");
  const bodyEl    = document.getElementById("event-detail-body");
  const footerEl  = document.getElementById("event-detail-footer");
  const actionsEl = document.getElementById("event-detail-actions");

  titleEl.textContent = ev.title;

  // Meta: date/time + location
  const start    = new Date(ev.start);
  const end      = new Date(ev.end);
  const dateStr  = start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr  = ev.start.includes("T")
    ? `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`
    : "All day";

  let locationHtml = "";
  if (ev.location) {
    locationHtml = `<span>📍 ${formatAddressLink(ev.location)}</span>`;
  }

  metaEl.innerHTML = `
    <span>📅 ${dateStr}</span>
    <span>🕐 ${timeStr}</span>
    ${locationHtml}
    ${ev.linked_project_id ? `<span>🔗 Project: <strong>${ev.linked_project_id}</strong></span>` : ""}`;

  // Body: description with preserved line breaks and linkified phone numbers
  if (ev.description && ev.description.trim()) {
    const templateHtml = formatTemplateDescriptionHtml(ev.description);
    if (templateHtml) {
      bodyEl.innerHTML = templateHtml;
    } else {
      // Convert newlines to <br>, but escape any HTML in the description first.
      let safe = escapeHtml(ev.description).replace(/\n/g, "<br>");
      safe = linkifyPhoneNumbers(safe);
      bodyEl.innerHTML = safe;
    }
    bodyEl.style.display = "";
  } else {
    bodyEl.innerHTML = "<em>No description provided.</em>";
    bodyEl.style.display = "";
  }

  footerEl.innerHTML = "";

  // Store current event ID for project linking
  _currentEventId = ev.id;

  // Action buttons: linked projects get Add Sample + Open Project,
  // unlinked events get Link to Project button
  if (ev.linked_project_id) {
    const projectId = ev.linked_project_id;
    actionsEl.innerHTML = `
      <button class="event-action-btn event-action-primary" data-action="add-sample" data-project-id="${encodeURIComponent(projectId)}">
        + Add Sample
      </button>
      <button class="event-action-btn event-action-secondary" data-action="open-project" data-project-id="${encodeURIComponent(projectId)}">
        📁 Open Project
      </button>`;
  } else {
    actionsEl.innerHTML = `
      <button class="event-action-btn event-action-primary" data-action="link-project" style="width: 100%;">
        🔗 Link to Project
      </button>`;
  }

  overlay.classList.remove("hidden");
  document.getElementById("event-detail-close").focus();
}

function closeEventDetail() {
  document.getElementById("event-detail-overlay")?.classList.add("hidden");
}

async function openProjectSelector() {
  const projects = await loadProjects();
  if (!projects || projects.length === 0) {
    alert("No projects available to link.");
    return;
  }

  _projectSelectorProjects = projects;
  renderProjectSelectorList(_projectSelectorProjects, "");

  const searchInput = document.getElementById("project-selector-search");
  if (searchInput) {
    searchInput.value = "";
  }

  document.getElementById("project-selector-overlay").classList.remove("hidden");
  searchInput?.focus();
}

function renderProjectSelectorList(projects, query) {
  const listEl = document.getElementById("project-selector-list");
  if (!listEl) return;

  const normalizedQuery = String(query || "").trim().toLowerCase();

  const sorted = [...projects].sort((a, b) => {
    const aName = String(a.name || a.id || "").toLowerCase();
    const bName = String(b.name || b.id || "").toLowerCase();
    return aName.localeCompare(bName, undefined, { numeric: true });
  });

  const filtered = normalizedQuery
    ? sorted.filter(p => {
        const haystack = [p.name, p.id, p.client, p.address]
          .map(v => String(v || "").toLowerCase())
          .join(" ");
        return haystack.includes(normalizedQuery);
      })
    : sorted;

  if (!filtered.length) {
    listEl.innerHTML = "<p class=\"project-selector-empty\">No matching projects.</p>";
    return;
  }

  listEl.innerHTML = filtered
    .map(p => `
      <button class="project-selector-item" data-project-id="${encodeURIComponent(p.id)}">
        <div class="project-selector-name">${p.name || p.id}</div>
        ${p.address ? `<div class="project-selector-address">${p.address}</div>` : ""}
        ${p.client ? `<div class="project-selector-client">Client: ${p.client}</div>` : ""}
      </button>`)
    .join("");
}

function closeProjectSelector() {
  document.getElementById("project-selector-overlay")?.classList.add("hidden");
  const searchInput = document.getElementById("project-selector-search");
  if (searchInput) searchInput.value = "";
}

async function linkEventToProject(projectId) {
  if (!_currentEventId) return;

  const ev = _allEvents.find(e => e.id === _currentEventId);
  if (!ev) return;

  // Update event
  ev.linked_project_id = projectId;

  // If the project has no saved address yet, infer it from calendar location.
  const inferredAddress = cleanAddress(ev.location || "");
  if (inferredAddress) {
    const projects = await loadProjects();
    const project = projects.find(p => String(p.id) === String(projectId));
    const hasAddress = String(project?.address || "").trim().length > 0;
    if (project && !hasAddress) {
      project.address = inferredAddress;
      saveProjectAddressOverride(projectId, inferredAddress, project);
    }
  }

  // Save to localStorage
  const calendar = JSON.parse(localStorage.getItem("fieldkit_calendar") || "{}");
  const idx = Array.isArray(calendar?.events)
    ? calendar.events.findIndex(e => e.id === _currentEventId)
    : -1;
  if (idx >= 0) {
    calendar.events[idx].linked_project_id = projectId;
    localStorage.setItem("fieldkit_calendar", JSON.stringify(calendar));
  }

  if (Array.isArray(_calendar?.events)) {
    _calendar.events = _calendar.events.map(item =>
      item.id === _currentEventId ? { ...item, linked_project_id: projectId } : item
    );
  }

  // Close selectors and reopen event detail
  closeProjectSelector();
  openEventDetail(_currentEventId);
  
  // Re-render the week schedule
  renderWeekSchedule(_calendar || { events: _allEvents });
}


function initModal() {
  document.getElementById("event-detail-close")?.addEventListener("click", closeEventDetail);

  document.getElementById("event-detail-overlay")?.addEventListener("click", e => {
    if (e.target.id === "event-detail-overlay") closeEventDetail();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeEventDetail();
  });

  // Delegate clicks on week-event buttons
  document.getElementById("week-schedule")?.addEventListener("click", e => {
    const btn = e.target.closest(".week-event[data-event-id]");
    if (btn) openEventDetail(decodeURIComponent(btn.dataset.eventId));
  });

  // Delegate clicks on action buttons
  document.getElementById("event-detail-actions")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const projectId = decodeURIComponent(btn.dataset.projectId || "");

    if (action === "add-sample") {
      // Navigate to sample-entry.html and store the project ID in sessionStorage
      sessionStorage.setItem("fieldkit_preload_project_id", projectId);
      window.location.href = "sample-entry.html";
    } else if (action === "open-project") {
      // Navigate to project.html with the project ID
      window.location.href = `project.html?id=${encodeURIComponent(projectId)}`;
    } else if (action === "link-project") {
      // Open project selector
      openProjectSelector();
    }
  });

  // Project selector close button
  document.getElementById("project-selector-close")?.addEventListener("click", closeProjectSelector);

  document.getElementById("project-selector-search")?.addEventListener("input", e => {
    renderProjectSelectorList(_projectSelectorProjects, e.target.value);
  });

  // Project selector overlay (click outside)
  document.getElementById("project-selector-overlay")?.addEventListener("click", e => {
    if (e.target.id === "project-selector-overlay") closeProjectSelector();
  });

  // Project selector items
  document.getElementById("project-selector-list")?.addEventListener("click", e => {
    const btn = e.target.closest(".project-selector-item");
    if (btn) {
      const projectId = decodeURIComponent(btn.dataset.projectId);
      linkEventToProject(projectId);
    }
  });
}

// ------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------

async function init() {
  initModal();
  const section = document.getElementById("week-schedule");
  if (!section) return;

  section.innerHTML = `<p style="padding:16px;color:var(--bee-cloudy)">Loading schedule…</p>`;

  let calendar;
  try {
    calendar = await loadCalendar();
  } catch (err) {
    section.innerHTML = `<p style="padding:16px;color:var(--bee-honey)">Could not load calendar data.</p>`;
    console.warn("Dashboard calendar load failed:", err);
    return;
  }

  renderWeekSchedule(calendar);
}

document.addEventListener("DOMContentLoaded", init);

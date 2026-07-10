import { loadProjects, saveProjectAddressOverride } from "./projects.js";
import { loadVisits, saveVisits } from "./visits.js";
import { pad2, loadJSON } from "./utils.js";
import { importIcsUrlToStorage, loadStoredCalendar, LS_CALENDAR } from "./ics-parser.js";

const SHARED_CALENDAR_ICS = "assets/data/Testing Schedule Calendar.ics";

function normalizeCalendarAddress(location) {
  if (!location) return "";

  const match = String(location).match(/\(([^)]+)\)/);
  const raw = match ? match[1] : String(location);
  return raw.replace(/\\/g, "").trim();
}

function maybeUpdateProjectAddressFromEvent(projectId, event, projects) {
  const project = projects.find(p => String(p.id) === String(projectId));
  if (!project) return false;

  const hasAddress = String(project.address || "").trim().length > 0;
  if (hasAddress) return false;

  const inferredAddress = normalizeCalendarAddress(event?.location || "");
  if (!inferredAddress) return false;

  project.address = inferredAddress;
  return saveProjectAddressOverride(projectId, inferredAddress, project);
}

// -------------------------------
// LOAD CALENDAR
// -------------------------------
export async function loadCalendar() {
  const stored = loadStoredCalendar();

  // Primary source: shared ICS file committed to assets/data.
  // This lets every device load the same schedule without local rewiring.
  try {
    const calendar = await importIcsUrlToStorage(SHARED_CALENDAR_ICS);
    return {
      ...calendar,
      source: "ics-file",
      source_label: "Shared ICS"
    };
  } catch (err) {
    console.warn("ICS load failed, using fallback calendar source:", err);
  }

  // Fallback 1: previously synced local storage copy.
  if (stored) {
    return {
      ...stored,
      source: "local-storage",
      source_label: "Local Cache"
    };
  }

  // Fallback 2: legacy JSON calendar file.
  const raw = await loadJSON("assets/data/calendar.json");

  const toLinkedProjectId = value => {
    if (value == null) return null;
    const normalized = String(value).trim();
    if (!normalized || normalized.toLowerCase() === "null") return null;
    return normalized;
  };

  const extractByToken = (obj, token) => {
    for (const [key, value] of Object.entries(obj || {})) {
      if (typeof value === "string" && value.includes(token)) return key;
    }
    return "";
  };

  const normalizeEvent = event => {
    if (!event || typeof event !== "object") return null;

    const looksNormalized = typeof event.start === "string" || typeof event.title === "string";
    if (looksNormalized) {
      return {
        id: event.id || "",
        title: event.title || "Scheduled Visit",
        start: event.start || "",
        end: event.end || "",
        linked_project_id: toLinkedProjectId(event.linked_project_id)
      };
    }

    return {
      id: extractByToken(event, "['id']"),
      title: extractByToken(event, "['subject']") || "Scheduled Visit",
      start: extractByToken(event, "['start']?['dateTime']"),
      end: extractByToken(event, "['end']?['dateTime']"),
      linked_project_id: toLinkedProjectId(event.linked_project_id)
    };
  };

  const sourceEvents = Array.isArray(raw?.events)
    ? raw.events
    : Array.isArray(raw?.events?.body)
      ? raw.events.body
      : [];

  return {
    ...raw,
    source: "calendar-json",
    source_label: "Legacy JSON",
    events: sourceEvents
      .map(normalizeEvent)
      .filter(ev => ev && typeof ev.start === "string")
  };
}

// -------------------------------
// SHOW CALENDAR LINK PROMPT
// -------------------------------
function showCalendarLinkPrompt(event, projects, calendar) {
  const modal = document.getElementById("calendar-link-modal");
  const titleEl = document.getElementById("calendar-link-event-title");
  const timeEl = document.getElementById("calendar-link-event-time");
  const selectEl = document.getElementById("calendar-link-project-select");

  titleEl.textContent = event.title || "Scheduled Visit";
  timeEl.textContent = new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  selectEl.innerHTML = "";
  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.id})`;
    selectEl.appendChild(opt);
  });

  modal.classList.remove("hidden");

  document.getElementById("calendar-link-save-btn").onclick = async () => {
    const selectedId = selectEl.value;

    event.linked_project_id = selectedId;
    maybeUpdateProjectAddressFromEvent(selectedId, event, projects);
    
    // Update the stored calendar in localStorage
    calendar.events = calendar.events.map(ev =>
      ev.id === event.id ? { ...ev, linked_project_id: selectedId } : ev
    );
    localStorage.setItem(LS_CALENDAR, JSON.stringify(calendar));

    modal.classList.add("hidden");

    await autoCreateVisitFromEvent(event, selectedId);

    window.location.reload();
  };

  document.getElementById("calendar-link-cancel-btn").onclick = () => {
    modal.classList.add("hidden");
  };
}

// -------------------------------
// AUTO-CREATE VISIT FROM EVENT
// -------------------------------
async function autoCreateVisitFromEvent(event, projectId) {
  const visits = await loadVisits();

  let testType = "WT";
  if (/ABT/i.test(event.title)) testType = "ABT";
  if (/ELD/i.test(event.title)) testType = "ELD";

  const projectVisits = visits.filter(v => v.id === projectId && v.test_type === testType);
  const nextNum = (projectVisits.length + 1).toString().padStart(2, "0");

  const newVisit = {
    id: projectId,
    date: event.start.substring(0, 10),
    test_type: testType,
    visit_number: nextNum
  };

  visits.push(newVisit);

  saveVisits(visits);
}

// -------------------------------
// GLOBAL STATE
// -------------------------------
let projects = [];
let visits = [];
let sortColumn = null;
let sortAsc = true;
let hoverPreviewTimer = null;

// -------------------------------
// MAIN INITIALIZER
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const updateStickyOffsets = () => {
    const header = document.querySelector(".fk-header");
    const height = header ? Math.ceil(header.getBoundingClientRect().height) : 72;
    document.documentElement.style.setProperty("--fk-sticky-nav-height", `${height}px`);
  };

  updateStickyOffsets();
  window.addEventListener("resize", updateStickyOffsets);

  projects = await loadProjects();
  visits = await loadVisits();
  populateFilters(projects);

  document.getElementById("filter-pm").addEventListener("change", applyFilters);
  document.getElementById("filter-client").addEventListener("change", applyFilters);
  document.getElementById("filter-visits").addEventListener("change", applyFilters);

  document.getElementById("filter-clear").addEventListener("click", () => {
    document.getElementById("filter-pm").value = "";
    document.getElementById("filter-client").value = "";
    document.getElementById("filter-visits").value = "";
    document.getElementById("project-search").value = "";
    renderProjectCatalog(projects, visits);
  });

  renderProjectCatalog(projects, visits);

  document.getElementById("project-search").addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const filtered = projects.filter(p =>
      (p.name || "").toLowerCase().includes(term) ||
      (p.id || "").toLowerCase().includes(term) ||
      (p.manager || "").toLowerCase().includes(term)
    );
    renderProjectCatalog(filtered, visits);
  });

  // Load calendar + detect unlinked events
  const calendar = await loadCalendar();
  const today = new Date().toISOString().substring(0, 10);

  const unlinkedEvents = calendar.events.filter(ev =>
    ev.start.startsWith(today) && !ev.linked_project_id
  );

  if (unlinkedEvents.length > 0) {
    showCalendarLinkPrompt(unlinkedEvents[0], projects, calendar);
  }

  // Sorting
  document.querySelectorAll(".fk-project-table th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (!col) return;

      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = true;
      }

      const sorted = sortProjects(projects, visits);
      renderProjectCatalog(sorted, visits);
    });
  });
});

// -------------------------------
// POPULATE FILTERS
// -------------------------------
function populateFilters(projects) {
  const pmSet = new Set();
  const clientSet = new Set();

  projects.forEach(p => {
    if (p.manager) pmSet.add(p.manager);
    if (p.client) clientSet.add(p.client);
  });

  const pmSelect = document.getElementById("filter-pm");
  const clientSelect = document.getElementById("filter-client");

  pmSet.forEach(pm => {
    const opt = document.createElement("option");
    opt.value = pm;
    opt.textContent = pm;
    pmSelect.appendChild(opt);
  });

  clientSet.forEach(client => {
    const opt = document.createElement("option");
    opt.value = client;
    opt.textContent = client;
    clientSelect.appendChild(opt);
  });
}

// -------------------------------
// APPLY FILTERS
// -------------------------------
function applyFilters() {
  const pm = document.getElementById("filter-pm").value;
  const client = document.getElementById("filter-client").value;
  const visitFilter = document.getElementById("filter-visits").value;
  const term = document.getElementById("project-search").value.toLowerCase();

  const filtered = projects.filter(p => {
    const projectVisits = visits.filter(v => v.id === p.id);

    if (pm && p.manager !== pm) return false;
    if (client && p.client !== client) return false;

    if (visitFilter === "has" && projectVisits.length === 0) return false;
    if (visitFilter === "none" && projectVisits.length > 0) return false;

    if (term) {
      const match =
        (p.name || "").toLowerCase().includes(term) ||
        (p.id || "").toLowerCase().includes(term) ||
        (p.manager || "").toLowerCase().includes(term);
      if (!match) return false;
    }

    return true;
  });

  renderProjectCatalog(filtered, visits);
}

// -------------------------------
// RENDER PROJECT CATALOG
// -------------------------------
function renderProjectCatalog(projects, visits) {
  const tbody = document.getElementById("project-table-body");
  tbody.innerHTML = "";

  projects.forEach(project => {
    const projectVisits = visits.filter(v => v.id === project.id);

    const row = document.createElement("tr");
    row.dataset.projectId = project.id;
    row.innerHTML = `
      <td>${project.id}</td>
      <td>${project.name}</td>
      <td>${project.manager || ""}</td>
      <td>${projectVisits.length}</td>
      <td></td>
    `;

    row.addEventListener("click", () => {
      hideHoverProjectPreview();
      clearHoverPreviewTimer();
      openProject(project.id);
    });

    row.addEventListener("mouseenter", () => {
      scheduleHoverProjectPreview(project, projectVisits, row);
    });

    row.addEventListener("mouseleave", () => {
      clearHoverPreviewTimer();
      hideHoverProjectPreview();
    });

    tbody.appendChild(row);
  });
}

// -------------------------------
// SORTING
// -------------------------------
function sortProjects(projects, visits) {
  if (!sortColumn) return projects;

  return [...projects].sort((a, b) => {
    let av, bv;

    switch (sortColumn) {
      case "id":
        av = a.id;
        bv = b.id;
        break;
      case "name":
        av = a.name;
        bv = b.name;
        break;
      case "pm":
        av = a.manager || "";
        bv = b.manager || "";
        break;
      case "visits":
        av = visits.filter(v => v.id === a.id).length;
        bv = visits.filter(v => v.id === b.id).length;
        break;
    }

    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
}

function openProject(projectId) {
  window.location.href = `project.html?id=${encodeURIComponent(projectId)}`;
}

function clearHoverPreviewTimer() {
  if (hoverPreviewTimer) {
    clearTimeout(hoverPreviewTimer);
    hoverPreviewTimer = null;
  }
}

function scheduleHoverProjectPreview(project, projectVisits, row) {
  clearHoverPreviewTimer();
  hoverPreviewTimer = setTimeout(() => {
    showHoverProjectPreview(project, projectVisits, row);
  }, 3000);
}

function showHoverProjectPreview(project, projectVisits, row) {
  const preview = document.getElementById("project-hover-preview");
  if (!preview) return;

  document.getElementById("project-hover-title").textContent = project.name || project.id;
  document.getElementById("project-hover-id").textContent = project.id || "";
  document.getElementById("project-hover-client").textContent = project.client || "—";
  document.getElementById("project-hover-address").textContent = project.address || "—";
  document.getElementById("project-hover-visits").textContent = String(projectVisits.length);

  const rect = row.getBoundingClientRect();
  preview.classList.remove("hidden");

  const margin = 10;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const boxW = preview.offsetWidth;
  const boxH = preview.offsetHeight;

  let left = rect.right + margin;
  let top = rect.top;

  if (left + boxW > viewportW - margin) {
    left = rect.left - boxW - margin;
  }

  if (left < margin) left = margin;
  if (top + boxH > viewportH - margin) top = viewportH - boxH - margin;
  if (top < margin) top = margin;

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
}

function hideHoverProjectPreview() {
  const preview = document.getElementById("project-hover-preview");
  if (!preview) return;
  preview.classList.add("hidden");
}

window.addEventListener("scroll", hideHoverProjectPreview, { passive: true });
window.addEventListener("resize", hideHoverProjectPreview);

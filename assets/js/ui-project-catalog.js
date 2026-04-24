import { loadProjects } from "./projects.js";
import { loadVisits } from "./visits.js";
import { pad2, loadJSON, saveJSON } from "./utils.js";

// -------------------------------
// LOAD CALENDAR
// -------------------------------
export async function loadCalendar() {
  return await loadJSON("assets/data/calendar.json");
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
    await saveJSON("assets/data/calendar.json", calendar);

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

  await saveJSON("assets/data/visits.json", { visits });
}

// -------------------------------
// GLOBAL STATE
// -------------------------------
let projects = [];
let visits = [];
let sortColumn = null;
let sortAsc = true;

// -------------------------------
// MAIN INITIALIZER
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
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
    row.innerHTML = `
      <td>${project.id}</td>
      <td>${project.name}</td>
      <td>${project.manager || ""}</td>
      <td>${projectVisits.length}</td>
      <td></td>
    `;

    row.addEventListener("click", () => {
      document.querySelectorAll(".fk-project-table tr").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");

      showProjectDetails(project, projectVisits);
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

// -------------------------------
// PROJECT DETAILS PANEL
// -------------------------------
function showProjectDetails(project, projectVisits) {
  const pane = document.getElementById("project-details-pane");

  document.getElementById("details-name").textContent = project.name;
  document.getElementById("details-id").textContent = project.id;
  document.getElementById("details-pm").textContent = project.manager || "";
  document.getElementById("details-client").textContent = project.client || "";
  document.getElementById("details-address").textContent = project.address || "";
  document.getElementById("details-visits").textContent = projectVisits.length;

  const list = document.getElementById("details-visit-list");
  list.innerHTML = "";
  projectVisits.forEach(v => {
    const li = document.createElement("li");
    li.textContent = `${v.date} — ${v.test_type}${v.visit_number}`;
    list.appendChild(li);
  });

  document.getElementById("details-open").onclick = () => {
    window.location.href = `project.html?id=${encodeURIComponent(project.id)}`;
  };

  pane.classList.remove("hidden");
}

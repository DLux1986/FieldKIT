import { loadProjects } from "./projects.js";
import { loadVisits, saveVisits } from "./visits.js";
import { loadCalendar } from "./ui-project-catalog.js"; // or wherever you exported it
import { saveJSON } from "./utils.js";
import { formatSampleId } from "../../controllers/idGenerator.js";

// -------------------------------
// HELPERS
// -------------------------------
function getProjectVisits(visits, projectId) {
  return visits.filter(visit => {
    const visitProjectId = visit.project_id ?? visit.projectId ?? visit.id;
    return String(visitProjectId) === String(projectId);
  });
}

function getNextVisitNumber(projectId, testType, visits) {
  const matching = getProjectVisits(visits, projectId).filter(visit =>
    (visit.test_type || "").toUpperCase() === testType.toUpperCase()
  );

  const numbers = matching
    .map(visit => Number.parseInt(visit.visit_number, 10))
    .filter(Number.isFinite);

  const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  return String(nextNumber).padStart(2, "0");
}

function findEventsForProject(project, calendar) {
  if (!calendar || !calendar.events) return [];
  return calendar.events.filter(ev => ev.linked_project_id === project.id);
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
// LINKING PROMPT
// -------------------------------
function showCalendarLinkPrompt(event, project, calendar) {
  const modal = document.getElementById("calendar-link-modal");
  const titleEl = document.getElementById("calendar-link-event-title");
  const timeEl = document.getElementById("calendar-link-event-time");
  const selectEl = document.getElementById("calendar-link-project-select");

  titleEl.textContent = event.title || "Scheduled Visit";
  timeEl.textContent = new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  selectEl.innerHTML = "";
  project.forEach(p => {
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
// MAIN PAGE LOGIC
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("back-to-catalog-btn").addEventListener("click", () => {
    window.location.href = "project-catalog.html";
  });

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id") || urlParams.get("projectId");
  const fallbackName = urlParams.get("projectName") || "";
  const fallbackClient = urlParams.get("client") || "";
  const fallbackManager = urlParams.get("manager") || "";
  const fallbackAddress = urlParams.get("address") || "";

  const projects = await loadProjects();
  const calendar = await loadCalendar();
  let visits = await loadVisits();

  const project = projects.find(p => p.id === projectId) || {
    id: projectId || "",
    name: fallbackName,
    client: fallbackClient,
    manager: fallbackManager,
    address: fallbackAddress
  };

  if (!project || (!project.id && !project.name)) return;

  document.getElementById("project-title").textContent = project.name || "Project";

  const projectVisits = getProjectVisits(visits, project.id);
  const projectEvents = findEventsForProject(project, calendar);

  renderProjectDetails(project, projectVisits, projectEvents);
  renderVisitList(project, visits);
  bindVisitModal(project, () => visits);

  // Check for unlinked events for THIS project
  const today = new Date().toISOString().substring(0, 10);
  const unlinked = calendar.events.filter(ev =>
    ev.start.startsWith(today) && !ev.linked_project_id
  );

  if (unlinked.length > 0) {
    showCalendarLinkPrompt(unlinked[0], projects, calendar);
  }
});

// -------------------------------
// RENDER PROJECT DETAILS
// -------------------------------
function bindVisitModal(project, getVisits) {
  const modal = document.getElementById("visit-edit-modal");
  const addBtn = document.getElementById("add-visit-btn");
  const dateInput = document.getElementById("edit-visit-date");
  const typeInput = document.getElementById("edit-visit-type");
  const notesInput = document.getElementById("edit-visit-notes");
  const saveBtn = document.getElementById("save-visit-btn");
  const cancelBtn = document.getElementById("cancel-visit-btn");

  addBtn.addEventListener("click", () => {
    dateInput.value = new Date().toISOString().substring(0, 10);
    typeInput.value = "WT";
    notesInput.value = "";
    modal.classList.remove("hidden");
  });

  cancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  saveBtn.addEventListener("click", async () => {
    const currentVisits = getVisits();
    const date = dateInput.value;
    const testType = typeInput.value;
    const notes = notesInput.value;

    if (!date || !project.id) {
      modal.classList.add("hidden");
      return;
    }

    const nextNumber = getNextVisitNumber(project.id, testType, currentVisits);
    const newVisit = {
      id: crypto.randomUUID(),
      project_id: project.id,
      date,
      test_type: testType,
      visit_number: nextNumber,
      notes
    };

    const updatedVisits = [...currentVisits, newVisit];
    saveVisits(updatedVisits);
    renderVisitList(project, updatedVisits);
    renderProjectDetails(project, getProjectVisits(updatedVisits, project.id), []);
    modal.classList.add("hidden");
  });
}

function renderVisitList(project, visits) {
  const container = document.getElementById("visit-list");
  if (!container) return;

  const projectVisits = getProjectVisits(visits, project.id);
  container.innerHTML = "";

  if (!projectVisits.length) {
    container.innerHTML = "<p>No visits yet.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "fk-visit-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Visit Date</th>
        <th>Visit Type</th>
        <th>Total Test Samples</th>
        <th>Total Pass</th>
        <th>Total Fail</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const body = table.querySelector("tbody");

  projectVisits.forEach(visit => {
    const row = document.createElement("tr");
    const visitLabel = `${visit.test_type || ""}${visit.visit_number || ""}`;
    const sampleCount = visit.sampleCount || 0;
    const passCount = visit.passCount || 0;
    const failCount = visit.failCount || 0;

    row.innerHTML = `
      <td>${visit.date || ""}</td>
      <td>${visitLabel}</td>
      <td>${sampleCount}</td>
      <td>${passCount}</td>
      <td>${failCount}</td>
      <td>
        <button class="fk-add-sample-btn" data-visit-id="${visit.id}">Add Test Sample</button>
      </td>
    `;

    body.appendChild(row);
  });

  container.appendChild(table);

  container.querySelectorAll(".fk-add-sample-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const visitId = btn.dataset.visitId;
      const targetVisit = projectVisits.find(visit => visit.id === visitId);
      if (!targetVisit) return;

      const url = new URL("sample-entry.html", window.location.href);
      url.searchParams.set("projectId", project.id);
      url.searchParams.set("projectName", project.name);
      url.searchParams.set("address", project.address || "");
      url.searchParams.set("visitId", targetVisit.id);
      url.searchParams.set("sample", "new");
      window.location.href = url.toString();
    });
  });
}

function renderProjectDetails(project, projectVisits, projectEvents) {
  const pane = document.getElementById("project-details-pane");
  pane.classList.remove("hidden");

  document.getElementById("details-name").textContent = project.name;
  document.getElementById("details-id").textContent = project.id;
  document.getElementById("details-pm").textContent = project.manager || "";
  document.getElementById("details-client").textContent = project.client || "";
  document.getElementById("details-address").textContent = project.address || "";
  document.getElementById("details-visits").textContent = projectVisits.length;

  const list = document.getElementById("details-visit-list");
  if (list) {
    list.innerHTML = "";

    projectVisits.forEach(v => {
      const li = document.createElement("li");
      li.textContent = `${v.date} — ${v.test_type}${v.visit_number}`;
      list.appendChild(li);
    });
  }

  const eventList = document.getElementById("details-calendar-events");
  if (eventList) {
    eventList.innerHTML = "";
    projectEvents.forEach(ev => {
      const li = document.createElement("li");
      li.textContent = `${ev.start.substring(0, 10)} — ${ev.title}`;
      eventList.appendChild(li);
    });
  }
}

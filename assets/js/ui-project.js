import { loadProjects, saveProjectAddressOverride } from "./projects.js";
import { loadVisits, saveVisits } from "./visits.js";
import { loadSamples, saveSamples } from "./samples.js";
import { loadCalendar } from "./ui-project-catalog.js"; // or wherever you exported it
import { loadStoredCalendar, LS_CALENDAR } from "./ics-parser.js";
import { formatSampleId, parseSampleId } from "../../controllers/idGenerator.js";

function isPersonnelOffEvent(event) {
  const title = String(event?.title || "").trim();
  if (!title) return false;

  // Match patterns like "Chris Off", "Dave Off at 2pm".
  return /^[A-Za-z]+(?:\s+[A-Za-z]+)?\s+off\b/i.test(title);
}

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
  saveVisits(visits);
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
    maybeUpdateProjectAddressFromEvent(selectedId, event, project);
    
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
  let samples = loadSamples();

  const project = projects.find(p => p.id === projectId) || {
    id: projectId || "",
    name: fallbackName,
    client: fallbackClient,
    manager: fallbackManager,
    address: fallbackAddress
  };

  if (!project || (!project.id && !project.name)) return;

  const projectTitleEl = document.getElementById("project-title");
  if (projectTitleEl) {
    projectTitleEl.textContent = project.name || "Project";
  }

  const projectVisits = getProjectVisits(visits, project.id);
  const projectEvents = findEventsForProject(project, calendar);

  renderProjectDetails(project, projectVisits, projectEvents);
  renderVisitList(project, visits, samples);
  bindVisitModal(
    project,
    () => visits,
    updatedVisits => {
      visits = updatedVisits;
    }
  );

  // Check for unlinked events for THIS project
  const today = new Date().toISOString().substring(0, 10);
  const unlinked = calendar.events.filter(ev =>
    ev.start.startsWith(today) &&
    !ev.linked_project_id &&
    !isPersonnelOffEvent(ev)
  );

  if (unlinked.length > 0) {
    showCalendarLinkPrompt(unlinked[0], projects, calendar);
  }
});

// -------------------------------
// RENDER PROJECT DETAILS
// -------------------------------
function bindVisitModal(project, getVisits, setVisits) {
  const modal = document.getElementById("visit-edit-modal");
  const addBtn = document.getElementById("add-visit-btn");
  const dateInput = document.getElementById("edit-visit-date");
  const typeInput = document.getElementById("edit-visit-type");
  const notesInput = document.getElementById("edit-visit-notes");
  const leadTechnicianInput = document.getElementById("edit-lead-technician");
  const technician2Input = document.getElementById("edit-technician-2");
  const witnessName1Input = document.getElementById("edit-witness-name-1");
  const witnessName2Input = document.getElementById("edit-witness-name-2");
  const witnessCompany1Input = document.getElementById("edit-witness-company-1");
  const witnessCompany2Input = document.getElementById("edit-witness-company-2");
  const witnessRole1Input = document.getElementById("edit-witness-role-1");
  const witnessRole2Input = document.getElementById("edit-witness-role-2");
  const saveBtn = document.getElementById("save-visit-btn");
  const cancelBtn = document.getElementById("cancel-visit-btn");

  addBtn.addEventListener("click", () => {
    dateInput.value = new Date().toISOString().substring(0, 10);
    typeInput.value = "WT";
    notesInput.value = "";
    if (leadTechnicianInput) leadTechnicianInput.value = "";
    if (technician2Input) technician2Input.value = "";
    if (witnessName1Input) witnessName1Input.value = "";
    if (witnessName2Input) witnessName2Input.value = "";
    if (witnessCompany1Input) witnessCompany1Input.value = "";
    if (witnessCompany2Input) witnessCompany2Input.value = "";
    if (witnessRole1Input) witnessRole1Input.value = "";
    if (witnessRole2Input) witnessRole2Input.value = "";
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
    const personnel = {
      leadTechnician: leadTechnicianInput?.value || "",
      technician2: technician2Input?.value || ""
    };
    const witnesses = {
      witness_name_1: witnessName1Input?.value || "",
      witness_name_2: witnessName2Input?.value || "",
      witness_company_1: witnessCompany1Input?.value || "",
      witness_company_2: witnessCompany2Input?.value || "",
      witness_role_1: witnessRole1Input?.value || "",
      witness_role_2: witnessRole2Input?.value || ""
    };

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
      notes,
      personnel,
      witnesses,
      lead_technician: personnel.leadTechnician,
      technician_2: personnel.technician2,
      witness_name_1: witnesses.witness_name_1,
      witness_name_2: witnesses.witness_name_2,
      witness_company_1: witnesses.witness_company_1,
      witness_company_2: witnesses.witness_company_2,
      witness_role_1: witnesses.witness_role_1,
      witness_role_2: witnesses.witness_role_2
    };

    const updatedVisits = [...currentVisits, newVisit];
    setVisits(updatedVisits);
    saveVisits(updatedVisits);
    renderVisitList(project, updatedVisits);
    renderProjectDetails(project, getProjectVisits(updatedVisits, project.id), []);
    modal.classList.add("hidden");
  });
}

function renderVisitList(project, visits, samples) {
  const container = document.getElementById("visit-list");
  if (!container) return;

  // Load samples if not provided
  if (!samples) {
    samples = loadSamples();
  }

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
    row.classList.add("fk-visit-row");
    row.style.cursor = "pointer";
    const visitLabel = `${visit.test_type || ""}${visit.visit_number || ""}`;
    
    // Calculate sample counts from actual samples
    const visitSamples = samples.filter(s => s.visit_id === visit.id);
    const sampleCount = visitSamples.length;
    const passCount = visitSamples.filter(s => s.result === "pass" || s.result === "PASS").length;
    const failCount = visitSamples.filter(s => s.result === "fail" || s.result === "FAIL").length;

    row.innerHTML = `
      <td>${visit.date || ""}</td>
      <td>${visitLabel}</td>
      <td>${sampleCount}</td>
      <td>${passCount}</td>
      <td>${failCount}</td>
      <td>
        <button class="fk-add-sample-btn" data-visit-id="${visit.id}">Add Test Sample</button>
        <button class="fk-delete-visit-btn" data-visit-id="${visit.id}">Delete Visit</button>
      </td>
    `;

    row.addEventListener("click", () => {
      const url = new URL("visit.html", window.location.href);
      url.searchParams.set("projectId", project.id);
      url.searchParams.set("visitId", visit.id);
      window.location.href = url.toString();
    });

    body.appendChild(row);
  });

  container.appendChild(table);

  container.querySelectorAll(".fk-add-sample-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      // Keep button action independent from row click navigation.
      e.stopPropagation();
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

  container.querySelectorAll(".fk-delete-visit-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();

      const visitId = btn.dataset.visitId;
      const targetVisit = projectVisits.find(visit => String(visit.id) === String(visitId));
      if (!targetVisit) return;

      const linkedSamples = samples.filter(s => String(s.visit_id) === String(visitId));
      const warning = `Delete visit ${targetVisit.test_type || ""}${targetVisit.visit_number || ""}?\n\nThis will also delete ${linkedSamples.length} sample${linkedSamples.length === 1 ? "" : "s"} linked to this visit.`;
      if (!window.confirm(warning)) return;

      const updatedVisits = visits.filter(v => String(v.id) !== String(visitId));
      const updatedSamples = samples.filter(s => String(s.visit_id) !== String(visitId));

      saveVisits(updatedVisits);
      saveSamples(updatedSamples);

      renderVisitList(project, updatedVisits, updatedSamples);
      renderProjectDetails(project, getProjectVisits(updatedVisits, project.id), []);
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

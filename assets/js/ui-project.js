import { loadProjects } from "./projects.js";
import { loadVisits } from "./visits.js";
import { loadCalendar } from "./ui-project-catalog.js"; // or wherever you exported it
import { saveJSON } from "./utils.js";

// -------------------------------
// FIND EVENTS FOR THIS PROJECT
// -------------------------------
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
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");

  const projects = await loadProjects();
  const visits = await loadVisits();
  const calendar = await loadCalendar();

  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  const projectVisits = visits.filter(v => v.id === projectId);
  const projectEvents = findEventsForProject(project, calendar);

  renderProjectDetails(project, projectVisits, projectEvents);

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
function renderProjectDetails(project, projectVisits, projectEvents) {
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

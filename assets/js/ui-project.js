import { loadProjects } from "./projects.js";
import { loadVisits, saveVisits, createVisit } from "./visits.js";
import { loadSamples } from "./samples.js";
import { getQueryParam, saveJSON } from "./utils.js";

/* -------------------------------------------------------
   Helper: Fetch a single project by ID
------------------------------------------------------- */
async function getProjectById(id) {
  const projects = await loadProjects();
  return projects.find(p => p.id === id);
}

/* -------------------------------------------------------
   Render visits for a project
------------------------------------------------------- */
export function renderVisitsForProject(project, visits, samples, container) {
  container.innerHTML = "";

  const projectVisits = visits.filter(v => v.project_id === project.id);

  projectVisits.forEach(v => {
    const div = document.createElement("div");
    div.className = "visit-row";
    div.textContent = `${v.date} — ${v.test_type} ${v.visit_number}`;
    container.appendChild(div);
  });
}

/* -------------------------------------------------------
   Main Page Load
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const projectId = getQueryParam("id");
  const project = await getProjectById(projectId);
  const visits = await loadVisits();
  const samples = await loadSamples();

  const titleEl = document.getElementById("project-title");
  const metaEl = document.getElementById("project-meta");
  const visitListEl = document.getElementById("visit-list");

  if (!project) {
    titleEl.textContent = "Project not found";
    return;
  }

  titleEl.textContent = `${project.name} (${project.id})`;
  metaEl.textContent = `PM: ${project.manager || "—"} | Client: ${project.client || "—"} | ${project.address || ""}`;

  renderVisitsForProject(project, visits, samples, visitListEl);

  /* -------------------------------------------------------
     Add Visit Button
  ------------------------------------------------------- */
  document.getElementById("add-visit-btn").addEventListener("click", async () => {
  const testType = prompt("Test Type (WT, ABT, ELD):");
  if (!testType) return;

  const date = prompt("Visit Date (YYYY-MM-DD):");
  if (!date) return;

  const projectId = getQueryParam("id");
  const project = await getProjectById(projectId);

  // Create visit
  const visit = createVisit({ project, testType, date });

  // Load → append → save
  const allVisits = loadVisits();
  allVisits.push(visit);
  saveVisits(allVisits);

  // Re-render
  const visits = loadVisits();
  const samples = await loadSamples();
  renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
});

});

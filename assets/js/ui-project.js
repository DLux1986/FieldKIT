// ui-project.js

import { loadProjects } from "./projects.js";
import { loadVisits } from "./visits.js";
import { loadSamples } from "./samples.js";
import { getQueryParam } from "./utils.js";

export function renderVisitsForProject(project, visits, samples, container) {
  container.innerHTML = "";

  const projectVisits = visits.filter(v => v.id === project.id);

  projectVisits.forEach(v => {
    const div = document.createElement("div");
    div.className = "visit-row";
    div.textContent = `${v.date} — ${v.test_type}${v.visit_number}`;
    container.appendChild(div);
  });
}


document.addEventListener("DOMContentLoaded", async () => {
  const projectId = getQueryParam("id");
  const project = (await loadProjects()).find(p => p.id === projectId);
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
  metaEl.textContent = `PM: ${project.manager || "—"} | Client: ${
    project.client || "—"
  } | ${project.address || ""}`;

  document.getElementById("back-to-catalog-btn").addEventListener("click", () => {
    window.location.href = "project-catalog.html";
  });


  renderVisitsForProject(project, visits, samples, visitListEl);
  document.getElementById("add-visit-btn").addEventListener("click", async () => {
  const testType = prompt("Test Type (WT, ABT, ELD):");
  if (!testType) return;

  const date = prompt("Visit Date (YYYY-MM-DD):");
  if (!date) return;

  const projectId = getQueryParam("project_id");
  const project = getProjectById(projectId);

  const visit = createVisit({ project, testType, date });

  await saveJSON("data/visits.json", { visits: VISITS });

  // Re-render
  const visits = await loadVisits();
  const samples = await loadSamples();
  renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
});

});

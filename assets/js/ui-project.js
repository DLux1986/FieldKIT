// ui-project.js

document.addEventListener("DOMContentLoaded", async () => {
  const projectId = getQueryParam("project_id");
  const project = (await loadProjects()).find(p => p.project_id === projectId);
  const visits = await loadVisits();
  const samples = await loadSamples();

  const titleEl = document.getElementById("project-title");
  const metaEl = document.getElementById("project-meta");
  const visitListEl = document.getElementById("visit-list");

  if (!project) {
    titleEl.textContent = "Project not found";
    return;
  }

  titleEl.textContent = `${project.project_name} (${project.project_id})`;
  metaEl.textContent = `PM: ${project.pm || "—"} | Customer: ${
    project.customer || "—"
  } | ${project.address || ""}`;

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

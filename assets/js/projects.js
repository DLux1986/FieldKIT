// projects.js

let PROJECTS = [];

async function loadProjects() {
  if (PROJECTS.length) return PROJECTS;
  PROJECTS = (await loadJSON("data/projects.json")).projects || [];
  return PROJECTS;
}

function getProjectById(projectId) {
  return PROJECTS.find(p => p.project_id === projectId) || null;
}

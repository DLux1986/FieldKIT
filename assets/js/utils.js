// utils.js

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

// stub – later this becomes API / backend write
async function saveJSON(path, data) {
  console.warn("saveJSON stub called for", path, data);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
function generateVisitFolderPath(projectId, fullVisitName) {
  const yearPrefix = projectId.substring(0, 2); // "19"
  const fullYear = `20${yearPrefix}`;
  return `S:\\_Projects\\${fullYear}\\${projectId} ... \\Reports\\Testing Reports\\${fullVisitName}`;
}

// metadata-manager.js — Hybrid Metadata Manager for FieldKIT

const GLOBAL_KEY = "fieldkit_metadata_global";

function projectKey(id) {
  return `project_${id}_metadata`;
}

function loadGlobal() {
  return JSON.parse(localStorage.getItem(GLOBAL_KEY)) || {};
}

function saveGlobal(data) {
  localStorage.setItem(GLOBAL_KEY, JSON.stringify(data));
}

function loadProject(id) {
  return JSON.parse(localStorage.getItem(projectKey(id))) || {};
}

function saveProject(id, data) {
  localStorage.setItem(projectKey(id), JSON.stringify(data));
}

function clearProject(id) {
  localStorage.removeItem(projectKey(id));
}

function $(id) {
  return document.getElementById(id);
}

let currentProject = null;

function fillForm(data) {
  $("metaTechs").value = data.technicians || "";
  $("metaWitness").value = data.witnesses || "";
  $("metaDate").value = data.testDate || "";
  $("metaTemp").value = data.temp_f || "";
  $("metaWind").value = data.wind_mph || "";
  $("metaWindDir").value = data.wind_dir || "";
  $("metaBaro").value = data.barometric || "";
}

function readForm() {
  return {
    technicians: $("metaTechs").value.trim(),
    witnesses: $("metaWitness").value.trim(),
    testDate: $("metaDate").value.trim(),
    temp_f: $("metaTemp").value.trim(),
    wind_mph: $("metaWind").value.trim(),
    wind_dir: $("metaWindDir").value.trim(),
    barometric: $("metaBaro").value.trim()
  };
}

async function loadProjectsForDropdown() {
  const r = await fetch("projects.json", { cache: "no-store" });
  const j = await r.json();
  const list = Array.isArray(j) ? j : j.projects;

  const sel = $("projectSelect");
  sel.innerHTML = `<option value="">Global Metadata</option>`;

  list.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.id} — ${p.name}`;
    sel.appendChild(opt);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProjectsForDropdown();

  // Load global metadata by default
  fillForm(loadGlobal());

  $("projectSelect").onchange = () => {
    const id = $("projectSelect").value;
    currentProject = id || null;

    if (!currentProject) {
      $("metaTitle").textContent = "Global Metadata";
      fillForm(loadGlobal());
      return;
    }

    $("metaTitle").textContent = `Project Metadata — ${currentProject}`;

    const projData = loadProject(currentProject);
    const globalData = loadGlobal();

    // Merge: project overrides global
    fillForm({ ...globalData, ...projData });
  };

  $("saveBtn").onclick = () => {
    const data = readForm();

    if (!currentProject) {
      saveGlobal(data);
      alert("Global metadata saved.");
    } else {
      saveProject(currentProject, data);
      alert(`Metadata saved for project ${currentProject}.`);
    }
  };

  $("clearBtn").onclick = () => {
    if (!currentProject) {
      alert("Cannot clear global metadata.");
      return;
    }
    clearProject(currentProject);
    alert(`Project metadata cleared for ${currentProject}.`);
    $("projectSelect").dispatchEvent(new Event("change"));
  };
});

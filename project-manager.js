// project-manager.js — BEE FieldKIT Project Manager

const LS_KEY = "fieldkit_projects";

async function loadMergedProjects() {
  // Load JSON baseline
  let jsonProjects = [];
  try {
    const r = await fetch("projects.json", { cache: "no-store" });
    const j = await r.json();
    jsonProjects = Array.isArray(j) ? j : j.projects;
  } catch (e) {
    console.warn("Could not load projects.json:", e);
  }

  // Load localStorage overrides
  const localProjects = JSON.parse(localStorage.getItem(LS_PROJECTS)) || [];

  // Merge: local overrides JSON
  const merged = [...jsonProjects];

  localProjects.forEach(lp => {
    const idx = merged.findIndex(p => p.id === lp.id);
    if (idx >= 0) merged[idx] = lp;
    else merged.push(lp);
  });

  return merged;
}


function saveLocalProjects(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function $(id) {
  return document.getElementById(id);
}

let editingIndex = null;

function refreshTable() {
  const tbody = document.querySelector("#pmTable tbody");
  const projects = loadLocalProjects();

  tbody.innerHTML = "";

  projects.forEach((p, i) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.client}</td>
      <td>${p.manager}</td>
      <td>${p.address}</td>
      <td>
        <button class="btn btn-line" data-edit="${i}">Edit</button>
        <button class="btn btn-line" data-del="${i}">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function clearForm() {
  $("projId").value = "";
  $("projName").value = "";
  $("projClient").value = "";
  $("projManager").value = "";
  $("projAddress").value = "";
}

function fillForm(p) {
  $("projId").value = p.id;
  $("projName").value = p.name;
  $("projClient").value = p.client;
  $("projManager").value = p.manager;
  $("projAddress").value = p.address;
}

function saveProject() {
  const p = {
    id: $("projId").value.trim(),
    name: $("projName").value.trim(),
    client: $("projClient").value.trim(),
    manager: $("projManager").value.trim(),
    address: $("projAddress").value.trim()
  };

  if (!p.id || !p.name) {
    alert("Project ID and Name are required.");
    return;
  }

  const list = loadLocalProjects();

  if (editingIndex !== null) {
    list[editingIndex] = p;
  } else {
    list.push(p);
  }

  saveLocalProjects(list);
  async function refreshTable() {
  const tbody = document.querySelector("#pmTable tbody");
  const projects = await loadMergedProjects();

  tbody.innerHTML = "";

  projects.forEach((p, i) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.client}</td>
      <td>${p.manager}</td>
      <td>${p.address}</td>
      <td>
        <button class="btn btn-line" data-edit="${i}">Edit</button>
        <button class="btn btn-line" data-del="${i}">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

  clearForm();

  $("formTitle").textContent = "New Project";
  $("cancelBtn").classList.add("hidden");
  editingIndex = null;
}

function startEdit(i) {
  const list = loadLocalProjects();
  const p = list[i];

  fillForm(p);
  editingIndex = i;

  $("formTitle").textContent = "Edit Project";
  $("cancelBtn").classList.remove("hidden");
}

function deleteProject(i) {
  if (!confirm("Delete this project?")) return;

  const list = loadLocalProjects();
  list.splice(i, 1);
  function saveProjectList(list) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(list));
}

  refreshTable();
}

document.addEventListener("DOMContentLoaded", () => {
  refreshTable();

  $("saveBtn").onclick = saveProject;

  $("cancelBtn").onclick = () => {
    editingIndex = null;
    clearForm();
    $("formTitle").textContent = "New Project";
    $("cancelBtn").classList.add("hidden");
  };

  document.querySelector("#pmTable tbody").onclick = e => {
    if (e.target.dataset.edit !== undefined) {
      startEdit(Number(e.target.dataset.edit));
    }
    if (e.target.dataset.del !== undefined) {
      deleteProject(Number(e.target.dataset.del));
    }
  };
});

// sample-manager.js — BEE FieldKIT Sample Manager

const LS_PROJECTS = "fieldkit_projects";

function projectSamplesKey(id) {
  return `project_${id}_samples`;
}

function $(id) {
  return document.getElementById(id);
}

let currentProjectId = null;
let currentSamples = [];
let editingIndex = null;

function log(msg) {
  $("logBox").textContent += msg + "\n";
}

function loadProjects() {
  return JSON.parse(localStorage.getItem(LS_PROJECTS)) || [];
}

function loadSamples(projectId) {
  return JSON.parse(localStorage.getItem(projectSamplesKey(projectId))) || [];
}

function saveSamples(projectId, samples) {
  localStorage.setItem(projectSamplesKey(projectId), JSON.stringify(samples));
}

function summarizeSample(s) {
  // Try to show something meaningful without assuming schema
  const parts = [];
  if (s.location) parts.push(`Location: ${s.location}`);
  if (s.unit) parts.push(`Unit: ${s.unit}`);
  if (s.product_type) parts.push(`Product: ${s.product_type}`);
  if (!parts.length) return "(no summary)";
  return parts.join(" | ");
}

function refreshProjectDropdown() {
  const sel = $("projectSelect");
  const projects = loadProjects();

  sel.innerHTML = `<option value="">Select a project…</option>`;

  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.id} — ${p.name}`;
    sel.appendChild(opt);
  });
}

function refreshSampleTable() {
  const tbody = $("sampleTable").querySelector("tbody");
  tbody.innerHTML = "";

  currentSamples.forEach((s, i) => {
    const row = document.createElement("tr");

    const sampleId = s.sampleId || `#${i + 1}`;

    row.innerHTML = `
      <td>${sampleId}</td>
      <td>${summarizeSample(s)}</td>
      <td>
        <button class="btn btn-line" data-edit="${i}">Edit</button>
        <button class="btn btn-line" data-dup="${i}">Duplicate</button>
        <button class="btn btn-line" data-del="${i}">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function startEditSample(index) {
  editingIndex = index;
  const s = currentSamples[index];
  $("editorTitle").textContent = `Editing Sample #${index + 1}`;
  $("sampleEditor").value = JSON.stringify(s, null, 2);
}

function cancelEdit() {
  editingIndex = null;
  $("editorTitle").textContent = "Sample Editor";
  $("sampleEditor").value = "";
}

function saveEditedSample() {
  if (editingIndex === null) {
    alert("No sample selected.");
    return;
  }

  try {
    const obj = JSON.parse($("sampleEditor").value);
    currentSamples[editingIndex] = obj;
    saveSamples(currentProjectId, currentSamples);
    refreshSampleTable();
    log(`Saved sample #${editingIndex + 1} for project ${currentProjectId}.`);
    cancelEdit();
  } catch (e) {
    alert("Invalid JSON. Please fix and try again.");
  }
}

function duplicateSample(index) {
  const original = currentSamples[index];
  const copy = { ...original };

  if (copy.sampleId) {
    copy.sampleId = `${copy.sampleId}-copy`;
  }

  currentSamples.splice(index + 1, 0, copy);
  saveSamples(currentProjectId, currentSamples);
  refreshSampleTable();
  log(`Duplicated sample #${index + 1} for project ${currentProjectId}.`);
}

function deleteSample(index) {
  if (!confirm("Delete this sample?")) return;
  currentSamples.splice(index, 1);
  saveSamples(currentProjectId, currentSamples);
  refreshSampleTable();
  log(`Deleted sample #${index + 1} for project ${currentProjectId}.`);
}

function exportProjectSamplesCsv() {
  if (!currentProjectId) {
    alert("Select a project first.");
    return;
  }

  if (!currentSamples.length) {
    log("No samples to export for this project.");
    return;
  }

  // Collect all keys across samples
  const allKeys = new Set();
  currentSamples.forEach(s => {
    Object.keys(s).forEach(k => allKeys.add(k));
  });

  const headers = ["projectId", ...Array.from(allKeys)];
  const rows = currentSamples.map(s => {
    return [
      currentProjectId,
      ...Array.from(allKeys).map(k => (s[k] ?? "").toString().replace(/,/g, " "))
    ].join(",");
  });

  const csv = headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `samples_${currentProjectId}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  log(`Exported samples for project ${currentProjectId} to CSV.`);
}

document.addEventListener("DOMContentLoaded", () => {
  refreshProjectDropdown();

  $("projectSelect").onchange = () => {
    const id = $("projectSelect").value;
    currentProjectId = id || null;
    cancelEdit();

    if (!currentProjectId) {
      currentSamples = [];
      refreshSampleTable();
      return;
    }

    currentSamples = loadSamples(currentProjectId);
    refreshSampleTable();
    log(`Loaded ${currentSamples.length} samples for project ${currentProjectId}.`);
  };

  $("sampleTable").querySelector("tbody").onclick = e => {
    if (e.target.dataset.edit !== undefined) {
      startEditSample(Number(e.target.dataset.edit));
    }
    if (e.target.dataset.dup !== undefined) {
      duplicateSample(Number(e.target.dataset.dup));
    }
    if (e.target.dataset.del !== undefined) {
      deleteSample(Number(e.target.dataset.del));
    }
  };

  $("saveSampleBtn").onclick = saveEditedSample;
  $("cancelEditBtn").onclick = cancelEdit;
  $("exportProjectCsv").onclick = exportProjectSamplesCsv;
});

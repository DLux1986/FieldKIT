/**
 * ui-visit-detail.js — Display a single visit with all samples
 * URL: visit.html?project_id=DEMO&visit_id=INIT01
 */

import { pad2 } from "./utils.js";
import { formatSampleId, parseSampleId, generateSampleId } from "../../controllers/idGenerator.js";
import { loadVisits, saveVisits } from "./visits.js";
import { loadSamples, saveSamples } from "./samples.js";

let VISITS = [];
let SAMPLES = [];
let PROJECTS = [];
let currentVisit = null;
let currentProject = null;

// ------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------

async function init() {
  try {
    VISITS = loadVisits();
    SAMPLES = loadSamples();
  } catch (err) {
    console.warn("Data load failed:", err);
    document.getElementById("samples-container").innerHTML = 
      `<p style="color:var(--bee-honey)">Could not load data.</p>`;
    return;
  }

  // Get query params
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project_id");
  const visitId = params.get("visit_id");

  if (!visitId || !projectId) {
    document.getElementById("samples-container").innerHTML = 
      `<p style="color:var(--bee-honey)">Missing project_id or visit_id parameter.</p>`;
    return;
  }

  // Find visit
  currentVisit = VISITS.find(v => v.visit_id === visitId && v.project_id === projectId);

  if (!currentVisit) {
    document.getElementById("samples-container").innerHTML = 
      `<p style="color:var(--bee-honey)">Visit not found.</p>`;
    return;
  }

  // Populate header
  document.getElementById("visit-id").textContent = currentVisit.visit_id;
  document.getElementById("visit-date").textContent = currentVisit.date;
  document.getElementById("visit-test-type").textContent = currentVisit.test_type;
  document.getElementById("visit-folder").textContent = currentVisit.folder_path || "—";
  document.getElementById("visit-notes").textContent = currentVisit.notes || "—";
  document.getElementById("visit-breadcrumb-id").textContent = currentVisit.visit_id;
  document.getElementById("page-title").textContent = `${currentVisit.visit_id} – ${currentVisit.date}`;

  // Set breadcrumb link
  document.getElementById("back-to-project-link").href = 
    `project.html?id=${encodeURIComponent(projectId)}`;

  // Load samples for this visit
  const visitSamples = SAMPLES
    .filter(s => s.visit_id === visitId)
    .map(s => ({ ...s, parsed: parseSampleId(s.sample_id) }))
    .sort((a, b) => {
      if (a.parsed.sampleNumber !== b.parsed.sampleNumber) {
        return a.parsed.sampleNumber - b.parsed.sampleNumber;
      }
      return a.parsed.testNumber - b.parsed.testNumber;
    });

  document.getElementById("sample-count").textContent = visitSamples.length;

  // Render samples table
  renderSamplesTable(visitSamples);

  // Wire event listeners
  setupEventListeners();
}

// ------------------------------------------------------------------
// RENDER SAMPLES TABLE
// ------------------------------------------------------------------

function renderSamplesTable(visitSamples) {
  const container = document.getElementById("samples-container");

  if (visitSamples.length === 0) {
    container.innerHTML = `<p style="padding:16px;color:var(--bee-cloudy)">No samples yet. <button id="add-sample-empty">Add Sample</button></p>`;
    document.getElementById("add-sample-empty").addEventListener("click", () => {
      openAddSamplePrompt();
    });
    return;
  }

  const table = document.createElement("table");
  table.className = "fk-sample-table";

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Sample</th>
      <th>Test</th>
      <th>Elevation</th>
      <th>Type</th>
      <th>Result</th>
      <th>QA</th>
      <th>Edit</th>
      <th>Open</th>
      <th>Retest</th>
    </tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  tbody.innerHTML = visitSamples
    .map((s, idx, arr) => {
      const isFirstOfGroup = 
        idx === 0 || 
        s.parsed.sampleNumber !== arr[idx - 1].parsed.sampleNumber;

      const groupFlags = getSampleQAFlags(
        arr.filter(x => x.parsed.sampleNumber === s.parsed.sampleNumber)
      );

      return `
        <tr class="${s.result === 'PASS' ? 'fk-row-pass' : s.result === 'FAIL' ? 'fk-row-fail' : ''}">
          <td>${isFirstOfGroup ? formatSampleId({ systemType: s.window_type || s.system_type || "", sampleNumber: s.parsed?.sampleNumber || s.sample_number || 1, testNumber: 1 }) : ""}</td>
          <td>T${pad2(s.parsed.testNumber)}</td>
          <td>${s.elevation || ""}</td>
          <td>${s.window_type || ""}</td>
          <td class="${s.result === 'PASS' ? 'fk-result-pass' : s.result === 'FAIL' ? 'fk-result-fail' : ''}">
            ${s.result || ""}
          </td>
          <td>
            ${groupFlags
              .map(f => `<span class="fk-qa-flag" data-flag="${f}">${f}</span>`)
              .join(" ")}
          </td>
          <td><button class="fk-sample-edit" data-id="${s.sample_id}">✎</button></td>
          <td><button class="fk-sample-open" data-id="${s.sample_id}">→</button></td>
          <td><button class="fk-sample-retest" data-id="${s.sample_id}">⟳</button></td>
        </tr>
      `;
    })
    .join("");
  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}

// ------------------------------------------------------------------
// QA FLAGS
// ------------------------------------------------------------------

function getSampleQAFlags(sampleGroup) {
  const flags = new Set();

  // RAP: Retest After Pass
  const hasPass = sampleGroup.some(s => s.result === "PASS");
  const hasMultiple = sampleGroup.length > 1;
  if (hasPass && hasMultiple) flags.add("RAP");

  // NO-PHOTO: Failed but missing photos
  sampleGroup.forEach(s => {
    if (s.result === "FAIL" && (!s.attachments || s.attachments.length === 0)) {
      flags.add("NO-PHOTO");
    }
  });

  // SEQ: Out-of-order test numbers
  sampleGroup.forEach((s, idx) => {
    const expected = idx + 1;
    if (s.parsed.testNumber !== expected) flags.add("SEQ");
  });

  return Array.from(flags);
}

// ------------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------------

function setupEventListeners() {
  // Add sample button
  document.getElementById("add-sample-btn")?.addEventListener("click", () => {
    openAddSamplePrompt();
  });

  // Edit visit button
  document.getElementById("edit-visit-btn")?.addEventListener("click", () => {
    openVisitEditModal();
  });

  // Sample edit buttons
  document.querySelectorAll(".fk-sample-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const sample = SAMPLES.find(s => s.sample_id === id);
      if (sample) enterInlineEditMode(btn.closest("tr"), sample);
    });
  });

  // Sample open buttons
  document.querySelectorAll(".fk-sample-open").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      window.location.href = `sample.html?sample_id=${encodeURIComponent(id)}`;
    });
  });

  // Sample retest buttons
  document.querySelectorAll(".fk-sample-retest").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const sample = SAMPLES.find(s => s.sample_id === id);
      if (sample) await handleRetest(sample);
    });
  });

  // Visit edit modal
  document.getElementById("save-visit-btn")?.addEventListener("click", async () => {
    await saveVisitChanges();
  });

  document.getElementById("cancel-visit-btn")?.addEventListener("click", () => {
    document.getElementById("visit-edit-modal").classList.add("hidden");
  });
}

// ------------------------------------------------------------------
// ADD SAMPLE
// ------------------------------------------------------------------

async function openAddSamplePrompt() {
  const windowType = prompt("Window Type (SLDR, FIXD, AWNG, etc.):");
  if (!windowType) return;

  const sampleId = generateSampleId(windowType, 
    (Math.max(...SAMPLES.filter(s => s.visit_id === currentVisit.visit_id).map(s => s.parsed.sampleNumber), 0) + 1),
    1
  );

  const sample = {
    sample_id: sampleId,
    visit_id: currentVisit.visit_id,
    project_id: currentVisit.project_id,
    window_type: windowType,
    sample_number: parseInt(sampleId.match(/S(\d{2})/)[1], 10),
    test_number: 1,
    elevation: "",
    product_type: "",
    manufacturer: "",
    result: "",
    notes: "",
    attachments: []
  };

  SAMPLES.push(sample);
  currentVisit.sample_ids.push(sampleId);

  saveSamples(SAMPLES);
  saveVisits(VISITS);

  // Refresh page
  location.reload();
}

// ------------------------------------------------------------------
// INLINE EDIT MODE
// ------------------------------------------------------------------

function enterInlineEditMode(row, sample) {
  row.innerHTML = `
    <td>${formatSampleId(sample.sample_id)}</td>
    <td><input id="edit-elevation" value="${sample.elevation || ""}" /></td>
    <td>
      <select id="edit-window-type">
        ${[
          "FIXD","AWNG","CASE","HUNG","SLDR","TILT","PCTR","PIVT",
          "CWOF","CWFX","WWAL","STFR","SING","DUBL","SLGD","TDRR"
        ]
          .map(t => `<option value="${t}" ${t === sample.window_type ? "selected" : ""}>${t}</option>`)
          .join("")}
      </select>
    </td>
    <td>
      <select id="edit-result">
        <option value="PASS" ${sample.result === "PASS" ? "selected" : ""}>PASS</option>
        <option value="FAIL" ${sample.result === "FAIL" ? "selected" : ""}>FAIL</option>
      </select>
    </td>
    <td><button class="fk-save-inline">Save</button></td>
    <td><button class="fk-cancel-inline">Cancel</button></td>
    <td></td>
  `;

  row.querySelector(".fk-save-inline").addEventListener("click", async () => {
    sample.elevation = document.getElementById("edit-elevation").value;
    sample.window_type = document.getElementById("edit-window-type").value;
    sample.result = document.getElementById("edit-result").value;

    saveSamples(SAMPLES);
    location.reload();
  });

  row.querySelector(".fk-cancel-inline").addEventListener("click", () => {
    location.reload();
  });
}

// ------------------------------------------------------------------
// VISIT EDIT MODAL
// ------------------------------------------------------------------

function openVisitEditModal() {
  const modal = document.getElementById("visit-edit-modal");
  document.getElementById("edit-visit-date").value = currentVisit.date;
  document.getElementById("edit-visit-type").value = currentVisit.test_type;
  document.getElementById("edit-visit-notes").value = currentVisit.notes || "";
  modal.classList.remove("hidden");
}

async function saveVisitChanges() {
  currentVisit.date = document.getElementById("edit-visit-date").value;
  currentVisit.test_type = document.getElementById("edit-visit-type").value;
  currentVisit.notes = document.getElementById("edit-visit-notes").value;

  if (currentProject) {
    currentVisit.full_name = `${currentVisit.date} ${currentProject.name} ${currentVisit.visit_id}`;
  }

  saveVisits(VISITS);
  document.getElementById("visit-edit-modal").classList.add("hidden");
  location.reload();
}

// ------------------------------------------------------------------
// RETEST
// ------------------------------------------------------------------

async function handleRetest(sample) {
  if (sample.result === "PASS") {
    const proceed = confirm(
      "⚠️ WARNING: This sample previously PASSED.\n\n" +
      "Retesting a passing sample is unusual and should only be done if:\n" +
      "• Test pressure changed\n" +
      "• Installation detail changed\n" +
      "• Technician or PM explicitly requested it\n\n" +
      "Are you sure you want to create a retest?"
    );
    if (!proceed) return;
  }

  const nextTest = sample.test_number + 1;
  const newId = `${sample.visit_id}-${sample.window_type}-S${pad2(sample.sample_number)}T${pad2(nextTest)}`;

  const retest = {
    ...sample,
    sample_id: newId,
    test_number: nextTest,
    result: "",
    notes: ""
  };

  SAMPLES.push(retest);
  saveSamples(SAMPLES);
  location.reload();
}

// ------------------------------------------------------------------
// RUN
// ------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

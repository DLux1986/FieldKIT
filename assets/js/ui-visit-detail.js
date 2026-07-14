import { pad2 } from "./utils.js";
import { formatSampleId, parseSampleId } from "../../controllers/idGenerator.js";
import { loadVisits, saveVisits } from "./visits.js";
import { loadSamples, saveSamples } from "./samples.js";

let VISITS = [];
let SAMPLES = [];
let currentVisit = null;
const VISIT_TABS = ["WT", "ABT", "ELD"];
let activeTab = "WT";

function normalizeVisitSharedFields(visit) {
  if (!visit) return visit;

  visit.personnel = {
    leadTechnician: visit.personnel?.leadTechnician || visit.lead_technician || "",
    technician2: visit.personnel?.technician2 || visit.technician_2 || ""
  };

  visit.witnesses = {
    witness_name_1: visit.witnesses?.witness_name_1 || visit.witness_name_1 || "",
    witness_company_1: visit.witnesses?.witness_company_1 || visit.witness_company_1 || "",
    witness_role_1: visit.witnesses?.witness_role_1 || visit.witness_role_1 || "",
    witness_name_2: visit.witnesses?.witness_name_2 || visit.witness_name_2 || "",
    witness_company_2: visit.witnesses?.witness_company_2 || visit.witness_company_2 || "",
    witness_role_2: visit.witnesses?.witness_role_2 || visit.witness_role_2 || ""
  };

  return visit;
}

function formatWitnessSummary(witnesses = {}) {
  const entries = [
    [witnesses.witness_name_1, witnesses.witness_company_1, witnesses.witness_role_1],
    [witnesses.witness_name_2, witnesses.witness_company_2, witnesses.witness_role_2]
  ]
    .map(parts => parts.filter(Boolean).join(" / "))
    .filter(Boolean);

  return entries.join("; ") || "—";
}

function visitDisplayId(visit) {
  const testType = visit?.test_type || "";
  const visitNum = visit?.visit_number || "";
  const compact = `${testType}${visitNum}`.trim();
  return compact || visit?.id || "Visit";
}

function visitParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    projectId: params.get("projectId") || params.get("project_id") || "",
    visitId: params.get("visitId") || params.get("visit_id") || ""
  };
}

function getVisitSamples(visitId) {
  return SAMPLES
    .filter(s => String(s.visit_id) === String(visitId))
    .map(s => ({ ...s, parsed: parseSampleId(s.sample_id || "") }))
    .sort((a, b) => {
      const aSample = a.parsed?.sampleNumber || 0;
      const bSample = b.parsed?.sampleNumber || 0;
      if (aSample !== bSample) return aSample - bSample;

      const aTest = a.parsed?.testNumber || 0;
      const bTest = b.parsed?.testNumber || 0;
      return aTest - bTest;
    });
}

function getSampleQAFlags(sampleGroup) {
  const flags = new Set();
  const hasPass = sampleGroup.some(s => s.result === "PASS");
  const hasRetest = sampleGroup.length > 1;

  if (hasPass && hasRetest) flags.add("RAP");

  sampleGroup.forEach(s => {
    if (s.result === "FAIL" && (!s.attachments || s.attachments.length === 0)) {
      flags.add("NO-PHOTO");
    }
  });

  const tests = sampleGroup.map(s => s.parsed?.testNumber || 0).filter(Boolean);
  if (tests.length && Math.min(...tests) !== 1) flags.add("SEQ");

  return Array.from(flags);
}

function renderVisitTabs() {
  const tabs = document.getElementById("visit-type-tabs");
  if (!tabs) return;

  tabs.innerHTML = "";
  VISIT_TABS.forEach(tab => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fk-visit-tab${tab === activeTab ? " active" : ""}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", tab === activeTab ? "true" : "false");
    btn.textContent = tab;
    btn.addEventListener("click", () => {
      activeTab = tab;
      renderVisitTabs();
      renderVisitSection();
    });
    tabs.appendChild(btn);
  });
}

function renderVisitSection() {
  const visitSamples = getVisitSamples(currentVisit.id);
  const isCurrentVisitType = activeTab === String(currentVisit.test_type || "").toUpperCase();
  const visibleSamples = isCurrentVisitType ? visitSamples : [];

  document.getElementById("sample-count").textContent = String(visibleSamples.length);
  renderSamplesTable(visibleSamples, { isCurrentVisitType });
}

function renderSamplesTable(visitSamples, options = {}) {
  const container = document.getElementById("samples-container");
  if (!container) return;

  const formatFailureSummary = (sample) => {
    if (sample.result !== "FAIL") return "—";

    const failure = sample.failure || {};
    const cycle = failure.cycleFailureOccurred ? `Cycle ${failure.cycleFailureOccurred}` : "";
    const time = failure.timeOfFailure ? `Time ${failure.timeOfFailure}` : "";
    const mode = failure.modeOfFailure || "";
    const location = failure.failureLocation || "";

    const details = [cycle, time, mode, location].filter(Boolean);
    return details.length ? details.join(" | ") : "Recorded failure";
  };

  const { isCurrentVisitType = true } = options;
  container.innerHTML = "";

  if (!isCurrentVisitType) {
    const empty = document.createElement("p");
    empty.className = "fk-visit-tab-note";
    empty.textContent = `No ${activeTab} data for this visit.`;
    container.appendChild(empty);
    return;
  }

  const isWindowTest = activeTab === "WT";

  if (!isWindowTest) {
    const note = document.createElement("p");
    note.style.margin = "0 0 12px";
    note.style.color = "var(--bee-cloudy)";
    note.textContent = "Detailed ABT/ELD sections are coming soon. Any captured samples for this visit are listed below.";
    note.className = "fk-visit-tab-note";
    container.appendChild(note);
  }

  if (!visitSamples.length) {
    const empty = document.createElement("p");
    empty.style.padding = "8px 0";
    empty.style.color = "var(--bee-cloudy)";
    empty.textContent = "No samples recorded for this visit yet.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "fk-sample-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Sample ID</th>
        <th>Series / Model</th>
        <th>System Type</th>
        <th>Elevation</th>
        <th>Unit Number</th>
        <th>Test Pressure (psf)</th>
        <th>Pass/Fail</th>
        <th>Failure Details</th>
      </tr>
    </thead>
    <tbody>
      ${visitSamples.map((s, idx, arr) => {
        const currentSample = s.parsed?.sampleNumber || 0;
        const prevSample = arr[idx - 1]?.parsed?.sampleNumber || -1;
        const isFirstOfGroup = idx === 0 || currentSample !== prevSample;

        const seriesModel = s.sampleDetails?.seriesModel || s.seriesModel || s.series_model || "";
        const systemType = s.window_type || s.system_type || s.parsed?.systemType || "";
        const elevation = s.sampleLocation?.elevation || s.elevation || "";
        const unitNumber = s.sampleLocation?.unitNumber || s.unit_number || "";
        const pressurePsf = s.testParameters?.pressure_psf ?? s.pressure_psf;
        const pressureText = pressurePsf === null || pressurePsf === undefined || pressurePsf === ""
          ? ""
          : Number.isFinite(Number(pressurePsf))
            ? Number(pressurePsf).toFixed(2)
            : String(pressurePsf);

        return `
          <tr class="${s.result === "PASS" ? "fk-row-pass" : s.result === "FAIL" ? "fk-row-fail" : ""}">
            <td>${isFirstOfGroup ? formatSampleId({ systemType: systemType || "", sampleNumber: currentSample || s.sample_number || 1, testNumber: 1 }) : ""}</td>
            <td>${seriesModel}</td>
            <td>${systemType}</td>
            <td>${elevation}</td>
            <td>${unitNumber}</td>
            <td>${pressureText}</td>
            <td class="${s.result === "PASS" ? "fk-result-pass" : s.result === "FAIL" ? "fk-result-fail" : ""}">${s.result || ""}</td>
            <td>${formatFailureSummary(s)}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;

  container.appendChild(table);
}

function setupHeader(projectId) {
  const display = visitDisplayId(currentVisit);
  document.getElementById("visit-id").textContent = display;
  document.getElementById("visit-date").textContent = currentVisit.date || "—";
  document.getElementById("visit-test-type").textContent = currentVisit.test_type || "—";
  document.getElementById("visit-folder").textContent = currentVisit.folder_path || "—";
  document.getElementById("visit-notes").textContent = currentVisit.notes || "—";
  document.getElementById("visit-lead-technician").textContent = currentVisit.personnel?.leadTechnician || "—";
  document.getElementById("visit-technician-2").textContent = currentVisit.personnel?.technician2 || "—";
  document.getElementById("visit-witness-summary").textContent = formatWitnessSummary(currentVisit.witnesses);
  document.getElementById("visit-breadcrumb-id").textContent = display;

  const title = `FieldKIT - Visit ${display}`;
  document.title = title;

  const backLink = document.getElementById("back-to-project-link");
  backLink.href = `project.html?id=${encodeURIComponent(projectId || currentVisit.project_id || "")}`;
}

function setupVisitActions() {
  document.getElementById("add-sample-btn")?.addEventListener("click", () => {
    const url = new URL("sample-entry.html", window.location.href);
    url.searchParams.set("projectId", currentVisit.project_id || "");
    url.searchParams.set("visitId", currentVisit.id || "");
    url.searchParams.set("sample", "new");
    window.location.href = url.toString();
  });

  document.getElementById("edit-visit-btn")?.addEventListener("click", () => {
    document.getElementById("edit-visit-date").value = currentVisit.date || "";
    document.getElementById("edit-visit-type").value = currentVisit.test_type || "WT";
    document.getElementById("edit-visit-notes").value = currentVisit.notes || "";
    document.getElementById("edit-lead-technician").value = currentVisit.personnel?.leadTechnician || "";
    document.getElementById("edit-technician-2").value = currentVisit.personnel?.technician2 || "";
    document.getElementById("edit-witness-name-1").value = currentVisit.witnesses?.witness_name_1 || "";
    document.getElementById("edit-witness-name-2").value = currentVisit.witnesses?.witness_name_2 || "";
    document.getElementById("edit-witness-company-1").value = currentVisit.witnesses?.witness_company_1 || "";
    document.getElementById("edit-witness-company-2").value = currentVisit.witnesses?.witness_company_2 || "";
    document.getElementById("edit-witness-role-1").value = currentVisit.witnesses?.witness_role_1 || "";
    document.getElementById("edit-witness-role-2").value = currentVisit.witnesses?.witness_role_2 || "";
    document.getElementById("visit-edit-modal")?.classList.remove("hidden");
  });

  document.getElementById("cancel-visit-btn")?.addEventListener("click", () => {
    document.getElementById("visit-edit-modal")?.classList.add("hidden");
  });

  document.getElementById("save-visit-btn")?.addEventListener("click", () => {
    currentVisit.date = document.getElementById("edit-visit-date").value;
    currentVisit.test_type = document.getElementById("edit-visit-type").value;
    currentVisit.notes = document.getElementById("edit-visit-notes").value;
    currentVisit.personnel = {
      leadTechnician: document.getElementById("edit-lead-technician").value,
      technician2: document.getElementById("edit-technician-2").value
    };
    currentVisit.witnesses = {
      witness_name_1: document.getElementById("edit-witness-name-1").value,
      witness_name_2: document.getElementById("edit-witness-name-2").value,
      witness_company_1: document.getElementById("edit-witness-company-1").value,
      witness_company_2: document.getElementById("edit-witness-company-2").value,
      witness_role_1: document.getElementById("edit-witness-role-1").value,
      witness_role_2: document.getElementById("edit-witness-role-2").value
    };

    saveVisits(VISITS);
    document.getElementById("visit-edit-modal")?.classList.add("hidden");
    window.location.reload();
  });

  document.getElementById("delete-visit-btn")?.addEventListener("click", () => {
    const projectId = currentVisit.project_id || "";
    const display = visitDisplayId(currentVisit);
    const linkedSamples = SAMPLES.filter(s => String(s.visit_id) === String(currentVisit.id));

    const warning = `Delete visit ${display}?\n\nThis will also delete ${linkedSamples.length} sample${linkedSamples.length === 1 ? "" : "s"} linked to this visit.`;
    if (!window.confirm(warning)) return;

    VISITS = VISITS.filter(v => String(v.id) !== String(currentVisit.id));
    SAMPLES = SAMPLES.filter(s => String(s.visit_id) !== String(currentVisit.id));

    saveVisits(VISITS);
    saveSamples(SAMPLES);

    const back = new URL("project.html", window.location.href);
    back.searchParams.set("id", projectId);
    window.location.href = back.toString();
  });
}

function showError(message) {
  const container = document.getElementById("samples-container");
  if (!container) return;
  container.innerHTML = `<p style="color:var(--bee-honey)">${message}</p>`;
}

function init() {
  const { projectId, visitId } = visitParams();

  VISITS = loadVisits();
  SAMPLES = loadSamples();

  if (!visitId) {
    showError("Missing visitId parameter.");
    return;
  }

  currentVisit = VISITS.find(v => String(v.id) === String(visitId) && (!projectId || String(v.project_id) === String(projectId)))
    || VISITS.find(v => String(v.id) === String(visitId));

  if (!currentVisit) {
    showError("Visit not found.");
    return;
  }

  normalizeVisitSharedFields(currentVisit);

  setupHeader(projectId);
  setupVisitActions();

  activeTab = String(currentVisit.test_type || "WT").toUpperCase();
  if (!VISIT_TABS.includes(activeTab)) activeTab = "WT";
  renderVisitTabs();
  renderVisitSection();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

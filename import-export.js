// import-export.js — BEE FieldKIT Import/Export Module
import { importIcsToStorage, loadStoredCalendar } from "./assets/js/ics-parser.js";
const LS_PROJECTS = "fieldkit_projects";
const LS_GLOBAL_META = "fieldkit_metadata_global";

function projectMetaKey(id) {
  return `project_${id}_metadata`;
}

function projectSamplesKey(id) {
  return `project_${id}_samples`;
}

function log(msg) {
  const box = document.getElementById("logBox");
  box.textContent += msg + "\n";
}

// ------------------------------------------------------------
// EXPORT FUNCTIONS
// ------------------------------------------------------------

function exportAllJson() {
  const data = {
    projects: JSON.parse(localStorage.getItem(LS_PROJECTS)) || [],
    globalMetadata: JSON.parse(localStorage.getItem(LS_GLOBAL_META)) || {},
    projectMetadata: {},
    samples: {}
  };

  // Collect project-specific metadata + samples
  data.projects.forEach(p => {
    const id = p.id;
    data.projectMetadata[id] =
      JSON.parse(localStorage.getItem(projectMetaKey(id))) || {};

    data.samples[id] =
      JSON.parse(localStorage.getItem(projectSamplesKey(id))) || [];
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  downloadBlob(blob, "fieldkit_backup.json");
  log("Exported all data to JSON.");
}

function exportProjectsCsv() {
  const list = JSON.parse(localStorage.getItem(LS_PROJECTS)) || [];

  if (!list.length) {
    log("No projects to export.");
    return;
  }

  const header = "id,name,client,manager,address\n";
  const rows = list
    .map(
      p =>
        `${p.id},${p.name},${p.client || ""},${p.manager || ""},${p.address || ""}`
    )
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  downloadBlob(blob, "projects.csv");
  log("Exported projects to CSV.");
}

function exportSamplesCsv() {
  const projects = JSON.parse(localStorage.getItem(LS_PROJECTS)) || [];
  let csv = "projectId,sampleId,field,value\n";

  projects.forEach(p => {
    const samples =
      JSON.parse(localStorage.getItem(projectSamplesKey(p.id))) || [];

    samples.forEach(s => {
      Object.entries(s).forEach(([field, value]) => {
        csv += `${p.id},${s.sampleId || ""},${field},${value}\n`;
      });
    });
  });

  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, "samples.csv");
  log("Exported samples to CSV.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// IMPORT FUNCTIONS
// ------------------------------------------------------------

async function importData(file, mode) {
  const text = await file.text();
  let data;

  if (file.name.endsWith(".json")) {
    data = JSON.parse(text);
    importJson(data, mode);
  } else if (file.name.endsWith(".csv")) {
    importCsv(text, mode);
  } else {
    log("Unsupported file type.");
  }
}

function importJson(data, mode) {
  if (mode === "overwrite") {
    localStorage.clear();
    log("Cleared all existing data (overwrite mode).");
  }

  if (data.projects) {
    mergeOrOverwrite(LS_PROJECTS, data.projects, mode);
    log("Imported projects.");
  }

  if (data.globalMetadata) {
    mergeOrOverwrite(LS_GLOBAL_META, data.globalMetadata, mode);
    log("Imported global metadata.");
  }

  if (data.projectMetadata) {
    Object.entries(data.projectMetadata).forEach(([id, meta]) => {
      mergeOrOverwrite(projectMetaKey(id), meta, mode);
    });
    log("Imported project metadata.");
  }

  if (data.samples) {
    Object.entries(data.samples).forEach(([id, samples]) => {
      mergeOrOverwrite(projectSamplesKey(id), samples, mode);
    });
    log("Imported samples.");
  }
}

function importCsv(text, mode) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",");

  if (header.includes("client")) {
    // It's a projects.csv
    const list = lines.map(line => {
      const cols = line.split(",");
      return {
        id: cols[0],
        name: cols[1],
        client: cols[2],
        manager: cols[3],
        address: cols[4]
      };
    });

    mergeOrOverwrite(LS_PROJECTS, list, mode);
    log("Imported projects from CSV.");
  } else {
    log("CSV format not recognized.");
  }
}

function mergeOrOverwrite(key, incoming, mode) {
  if (mode === "overwrite") {
    localStorage.setItem(key, JSON.stringify(incoming));
    return;
  }

  // Merge mode
  const existing = JSON.parse(localStorage.getItem(key)) || [];

  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const merged = [...existing];

    incoming.forEach(item => {
      const idx = merged.findIndex(x => x.id === item.id);
      if (idx >= 0) merged[idx] = item;
      else merged.push(item);
    });

    localStorage.setItem(key, JSON.stringify(merged));
  } else {
    localStorage.setItem(key, JSON.stringify({ ...existing, ...incoming }));
  }
}

// ------------------------------------------------------------
// CALENDAR ICS IMPORT
// ------------------------------------------------------------

async function importCalendarIcs(file) {
  const text = await file.text();
  let calendar;
  try {
    calendar = importIcsToStorage(text);
  } catch (err) {
    setIcsStatus(`❌ Parse error: ${err.message}`, "error");
    return;
  }

  const count = calendar.events.length;
  setIcsStatus(`✅ Synced ${count} event${count !== 1 ? "s" : ""} from ${file.name}`, "ok");
  renderIcsPreview(calendar.events);
}

function setIcsStatus(msg, type) {
  const el = $("icsStatus");
  el.textContent = msg;
  el.style.color = type === "error" ? "var(--bee-honey)" : "var(--bee-cloudy)";
}

function renderIcsPreview(events) {
  const container = $("icsPreview");
  if (!events.length) {
    container.innerHTML = "<p style='font-size:0.85rem;color:var(--bee-cloudy)'>No events found.</p>";
    return;
  }

  // Show next 10 upcoming events
  const now  = new Date();
  const upcoming = events
    .filter(e => e.start && new Date(e.start) >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 10);

  const rows = upcoming.map(e => {
    const d = new Date(e.start);
    const dateStr = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const linked  = e.linked_project_id
      ? `<span style="color:var(--bee-honey);font-weight:600;">${e.linked_project_id}</span>`
      : `<span style="color:#aaa">—</span>`;
    return `<tr>
      <td style="padding:6px 10px">${dateStr}</td>
      <td style="padding:6px 10px">${e.title}</td>
      <td style="padding:6px 10px">${e.location || "—"}</td>
      <td style="padding:6px 10px">${linked}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <p style="font-size:0.85rem;font-weight:600;margin-bottom:6px;">Next ${upcoming.length} upcoming events:</p>
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
      <thead>
        <tr style="border-bottom:2px solid var(--bee-cloudy);">
          <th style="text-align:left;padding:6px 10px">Date</th>
          <th style="text-align:left;padding:6px 10px">Title</th>
          <th style="text-align:left;padding:6px 10px">Location</th>
          <th style="text-align:left;padding:6px 10px">Linked Project</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ------------------------------------------------------------
// UI HOOKUP
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  $("exportAllJson").onclick = exportAllJson;
  $("exportProjectsCsv").onclick = exportProjectsCsv;
  $("exportSamplesCsv").onclick = exportSamplesCsv;

  $("icsImportBtn").onclick = () => {
    const file = $("icsFile").files[0];
    if (!file) {
      setIcsStatus("No file selected.", "error");
      return;
    }
    importCalendarIcs(file);
  };

  // Show current stored calendar status on page load
  const stored = loadStoredCalendar();
  if (stored) {
    const d    = new Date(stored.last_sync);
    const when = d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    setIcsStatus(`Last synced: ${when} — ${stored.events.length} events stored`, "ok");
    renderIcsPreview(stored.events);
  }

  $("importBtn").onclick = () => {
    const file = $("importFile").files[0];
    const mode = $("importMode").value;

    if (!file) {
      log("No file selected.");
      return;
    }

    importData(file, mode);
  };
});

function $(id) {
  return document.getElementById(id);
}

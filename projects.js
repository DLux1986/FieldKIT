// projects.js — BEE FieldKIT Project Loader
// Loads projects.json (preferred) or projects.csv (fallback)
// Populates the dashboard project table

export async function loadProjects({
  jsonUrl = "projects.json",
  csvUrl = "projects.csv"
} = {}) {
  // Try JSON first
  try {
    const r = await fetch(jsonUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`projects.json HTTP ${r.status}`);

    const j = await r.json();

    // Accept either:
    // [ {id, name, ...}, ... ]
    // or { projects: [ ... ] }
    if (Array.isArray(j)) return j;
    if (Array.isArray(j.projects)) return j.projects;

    throw new Error("projects.json has no 'projects' array");
  } catch (errJson) {
    console.warn("JSON load failed:", errJson);
  }

  // Fallback to CSV
  try {
    const r = await fetch(csvUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`projects.csv HTTP ${r.status}`);

    const text = await r.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift().split(",");

    const idx = name => header.indexOf(name);

    const nameI = idx("name");
    const idI = idx("id");
    const addrI = idx("address");
    const clientI = idx("client");
    const mgrI = idx("manager");

    return lines
      .map(line => {
        const cols = line.split(",");
        return {
          name: cols[nameI]?.trim(),
          id: cols[idI]?.trim(),
          address: cols[addrI]?.trim(),
          client: cols[clientI]?.trim(),
          manager: cols[mgrI]?.trim()
        };
      })
      .filter(p => p.id && p.name);
  } catch (errCsv) {
    console.error("CSV load failed:", errCsv);
    return [];
  }
}

// ------------------------------------------------------------
// Populate the dashboard table
// ------------------------------------------------------------

async function initProjectTable() {
  const tableBody = document.querySelector("#projectTable tbody");
  if (!tableBody) return;

  const projects = await loadProjects();

  tableBody.innerHTML = "";

  projects.forEach(p => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.client || ""}</td>
      <td>${p.manager || ""}</td>
      <td>${p.address || ""}</td>
      <td><button class="btn btn-line" data-open="${p.id}">Open</button></td>
    `;

    tableBody.appendChild(row);
  });

  // Handle "Open" buttons
  tableBody.addEventListener("click", e => {
    if (!e.target.dataset.open) return;

    const id = e.target.dataset.open;
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const url = new URL("project.html", location.href);
    url.searchParams.set("projectId", project.id);
    url.searchParams.set("projectName", project.name);
    url.searchParams.set("client", project.client || "");
    url.searchParams.set("manager", project.manager || "");
    url.searchParams.set("address", project.address || "");

    location.href = url.toString();
  });
}

document.addEventListener("DOMContentLoaded", initProjectTable);

// projects.js — BEE FieldKIT Project Loader
// Loads projects.json (preferred) or projects.csv (fallback)
// Populates the dashboard project table

const LS_PROJECTS = "fieldkit_projects";

function readLocalProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_PROJECTS) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function mergeProjectOverrides(baseProjects, localProjects) {
  const merged = Array.isArray(baseProjects) ? [...baseProjects] : [];

  for (const lp of localProjects) {
    if (!lp || !lp.id) continue;
    const idx = merged.findIndex(p => String(p.id) === String(lp.id));
    if (idx >= 0) merged[idx] = { ...merged[idx], ...lp };
    else merged.push(lp);
  }

  return merged;
}

export function saveProjectAddressOverride(projectId, address, projectSeed = {}) {
  if (!projectId) return false;
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) return false;

  const localProjects = readLocalProjects();
  const idx = localProjects.findIndex(p => String(p.id) === String(projectId));

  if (idx >= 0) {
    localProjects[idx] = {
      ...localProjects[idx],
      address: normalizedAddress
    };
  } else {
    localProjects.push({
      id: String(projectId),
      name: projectSeed.name || String(projectId),
      client: projectSeed.client || "",
      manager: projectSeed.manager || "",
      address: normalizedAddress
    });
  }

  localStorage.setItem(LS_PROJECTS, JSON.stringify(localProjects));
  return true;
}

export async function loadProjects() {
  // Try JSON first
  try {
    const res = await fetch("data/projects.json");
    const data = await res.json();

    if (Array.isArray(data)) return mergeProjectOverrides(data, readLocalProjects());
    if (Array.isArray(data.projects)) return mergeProjectOverrides(data.projects, readLocalProjects());

    console.warn("projects.json is not in a recognized format:", data);
  } catch (errJson) {
    console.warn("projects.json failed, falling back to CSV:", errJson);
  }

  // Fallback to CSV
  try {
    const csvUrl = "data/projects.csv";
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

    const csvProjects = lines
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

    return mergeProjectOverrides(csvProjects, readLocalProjects());
  } catch (errCsv) {
    console.error("CSV load failed:", errCsv);
    return mergeProjectOverrides([], readLocalProjects());
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

  tableBody.addEventListener("click", e => {
    if (!e.target.dataset.open) return;

    const id = e.target.dataset.open;
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const url = new URL("project.html", location.href);
    url.searchParams.set("id", project.id);
    url.searchParams.set("projectId", project.id);
    url.searchParams.set("projectName", project.name);
    url.searchParams.set("client", project.client || "");
    url.searchParams.set("manager", project.manager || "");
    url.searchParams.set("address", project.address || "");

    location.href = url.toString();
  });
}

document.addEventListener("DOMContentLoaded", initProjectTable);

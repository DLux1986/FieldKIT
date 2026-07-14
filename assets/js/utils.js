// utils.js

const LOCAL_JSON_OVERRIDE_PREFIX = "fieldkit_json_override:";

function localOverrideKey(path) {
  return `${LOCAL_JSON_OVERRIDE_PREFIX}${path}`;
}

function readLocalOverride(path) {
  try {
    const raw = localStorage.getItem(localOverrideKey(path));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeLocalOverride(path, data) {
  localStorage.setItem(localOverrideKey(path), JSON.stringify(data, null, 2));
}

function clearLocalOverride(path) {
  localStorage.removeItem(localOverrideKey(path));
}

export async function loadJSON(path) {
  const localOverride = readLocalOverride(path);
  if (localOverride != null) return localOverride;

  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}
export async function saveJSON(path, data) {
  try {
    const response = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data, null, 2)
    });

    if (!response.ok) {
      throw new Error(`PUT ${response.status}`);
    }

    clearLocalOverride(path);
    return true;
  } catch (err) {
    // Static hosting commonly rejects PUT to assets with 405.
    // Persist locally so app behavior still works without a write-capable backend.
    writeLocalOverride(path, data);
    console.warn(`saveJSON fell back to localStorage for ${path}:`, err);
    return true;
  }
}
export async function loadCalendar() {
  try {
    return await loadJSON("assets/data/calendar.json");
  } catch (err) {
    console.warn("Calendar JSON load failed:", err);
    return { events: [] };
  }
}

export function pad2(n) {
  return n.toString().padStart(2, "0");
}

export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function generateVisitFolderPath(projectId, fullVisitName) {
  const yearPrefix = projectId.substring(0, 2); // "19"
  const fullYear = `20${yearPrefix}`;
  return `S:\\_Projects\\${fullYear}\\${projectId} ... \\Reports\\Testing Reports\\${fullVisitName}`;
}
function getSampleQAFlags(sampleGroup) {
  const flags = [];

  const hasPass = sampleGroup.some(s => s.result === "PASS");
  const hasRetest = sampleGroup.length > 1;

  // Retest After Pass
  if (hasPass && hasRetest) {
    flags.push("RAP"); // Retest After Pass
  }

  // Missing Photos on FAIL
  sampleGroup.forEach(s => {
    if (s.result === "FAIL" && (!s.attachments || s.attachments.length === 0)) {
      flags.push("NO-PHOTO");
    }
  });

  // Out-of-sequence tests
  const testNumbers = sampleGroup.map(s => s.parsed.testNumber);
  if (Math.min(...testNumbers) !== 1) {
    flags.push("SEQ");
  }

  return [...new Set(flags)];
}

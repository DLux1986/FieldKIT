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

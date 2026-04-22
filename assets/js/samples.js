// samples.js

let SAMPLES = [];

export async function loadSamples() {
  const data = await loadJSON("assets/data/samples.json");
  return data.samples;
}


function getSamplesForVisit(visitId) {
  return SAMPLES.filter(s => s.visit_id === visitId);
}

function generateSampleId(visitId, windowType) {
  const existing = getSamplesForVisit(visitId).filter(
    s => s.window_type === windowType
  );

  const nextSampleNumber = existing.length + 1;
  const sampleNumber = `S${pad2(nextSampleNumber)}`;
  const testNumber = `T01`;

  return `${visitId}-${windowType}-${sampleNumber}${testNumber}`;
}

function parseSampleId(sampleId) {
  const match = sampleId.match(/^(WT\d{2}|ABT\d{2}|ELD\d{2})-([A-Z]+)-S(\d{2})T(\d{2})$/);
  if (!match) return null;

  return {
    visitId: match[1],
    windowType: match[2],
    sampleNumber: parseInt(match[3], 10),
    testNumber: parseInt(match[4], 10)
  };
}

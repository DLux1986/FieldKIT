// visits.js — localStorage powered

const VISITS_KEY = "visits";

export function loadVisits() {
  return JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
}

export function saveVisits(visits) {
  localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
}

export function createVisit({ project, testType, date }) {
  const allVisits = loadVisits();

  // Filter visits for this project + test type
  const projectVisits = allVisits.filter(
    v => v.project_id === project.id && v.test_type === testType
  );

  // Determine next visit number
  const nextNumber = projectVisits.length + 1;
  const visitNumber = String(nextNumber).padStart(2, "0");

  return {
    id: crypto.randomUUID(),
    project_id: project.id,
    test_type: testType,
    date,
    visit_number: visitNumber
  };
}

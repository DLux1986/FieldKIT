// visits.js

let VISITS = [];

export async function loadVisits() {
  const data = await loadJSON("assets/data/visits.json");
  return data.visits;
}



function getVisitsForProject(projectId) {
  return VISITS.filter(v => v.project_id === projectId);
}

function getNextVisitNumber(visits, testType) {
  const nums = visits
    .filter(v => v.test_type === testType)
    .map(v => v.visit_number || parseInt(v.visit_id.slice(2), 10))
    .filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function createVisit({ project, testType, date }) {
  const visits = getVisitsForProject(project.project_id);
  const nextNum = getNextVisitNumber(visits, testType);
  const visitId = `${testType}${pad2(nextNum)}`;
  const fullName = `${date} ${project.project_name} ${visitId}`;

  const visit = {
    visit_id: visitId,
    project_id: project.project_id,
    date,
    test_type: testType,
    visit_number: nextNum,
    full_name: fullName,
    folder_path: generateVisitFolderPath(project.project_id, fullName),
    notes: "",
    sample_ids: []
  };

  VISITS.push(visit);
  return visit;
}

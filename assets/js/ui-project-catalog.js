document.addEventListener("DOMContentLoaded", async () => {
  const projects = await loadProjects();
  const visits = await loadVisits();

  renderProjectCatalog(projects, visits);

  document.getElementById("project-search").addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const filtered = projects.filter(p =>
      p.project_name.toLowerCase().includes(term) ||
      p.project_id.toLowerCase().includes(term) ||
      (p.client || "").toLowerCase().includes(term)
    );
    renderProjectCatalog(filtered, visits);
  });
});

function renderProjectCatalog(projects, visits) {
  const tbody = document.getElementById("project-table-body");
  tbody.innerHTML = "";

  projects.forEach(project => {
    const projectVisits = visits.filter(v => v.project_id === project.project_id);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${project.project_id}</td>
      <td>${project.project_name}</td>
      <td>${project.client || ""}</td>
      <td>${project.manager || ""}</td>
      <td>${project.address || ""}</td>
      <td>${projectVisits.length}</td>
      <td><button class="fk-open-project" data-id="${project.project_id}">Open</button></td>
    `;

    row.querySelector(".fk-open-project").addEventListener("click", () => {
      window.location.href = `project.html?project_id=${encodeURIComponent(project.project_id)}`;
    });

    tbody.appendChild(row);
  });
}


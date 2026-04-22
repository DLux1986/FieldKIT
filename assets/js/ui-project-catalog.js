// ui-project-catalog.js

document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector("#project-table tbody");
  const searchInput = document.querySelector("#project-search");

  const projects = await loadProjects();
  let filtered = [...projects];

  function render() {
    tableBody.innerHTML = "";
    filtered.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.project_id}</td>
        <td>${p.project_name}</td>
        <td>${p.pm || ""}</td>
      `;
      tr.addEventListener("click", () => {
        window.location.href = `project.html?project_id=${encodeURIComponent(
          p.project_id
        )}`;
      });
      tableBody.appendChild(tr);
    });
  }

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    filtered = projects.filter(p =>
      [p.project_id, p.project_name, p.pm]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q))
    );
    render();
  });

  render();
});

// ui-visit.js

function renderVisitsForProject(project, visits, samples, container) {
  container.innerHTML = "";
  const projectVisits = visits.filter(v => v.project_id === project.project_id);

  projectVisits
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(visit => {
      const card = document.createElement("article");
      card.className = "fk-visit-card";

      const visitSamples = samples
      .filter(s => s.visit_id === visit.visit_id)
      .map(s => ({ ...s, parsed: parseSampleId(s.sample_id) }))
      .sort((a, b) => {
        if (a.parsed.sampleNumber !== b.parsed.sampleNumber) {
          return a.parsed.sampleNumber - b.parsed.sampleNumber;
        }
        return a.parsed.testNumber - b.parsed.testNumber;
      });


      card.innerHTML = `
        <header class="fk-visit-header">
          <button class="fk-visit-toggle">▼</button>
          <div>
            <strong>${visit.date} — ${visit.visit_id}</strong>
            <div>${visit.test_type}</div>
          </div>
        </header>

        <div class="fk-visit-body">
          <button class="fk-add-sample-btn" data-visit="${visit.visit_id}">Add Sample</button>
          <button class="fk-edit-visit-btn" data-visit="${visit.visit_id}">Edit Visit</button>

          <div class="fk-visit-meta">
            <div>Folder: ${visit.folder_path || "—"}</div>
            <div>Notes: ${visit.notes || ""}</div>
          </div>

          <table class="fk-sample-table">
            <thead>
              <tr>
                <th>Sample</th>
                <th>Test</th>
                <th>Elevation</th>
                <th>Type</th>
                <th>Result</th>
                <th>QA</th>
                <th>Edit</th>
                <th>Open</th>
                <th>Retest</th>
              </tr>
            </thead>

            <tbody>
              ${visitSamples
                .map((s, idx, arr) => {
                  const isFirstOfGroup =
                    idx === 0 ||
                    s.parsed.sampleNumber !== arr[idx - 1].parsed.sampleNumber;

                  const groupFlags = getSampleQAFlags(
                    arr.filter(x => x.parsed.sampleNumber === s.parsed.sampleNumber)
                  );

                  return `
                    <tr class="${s.result === 'PASS' ? 'fk-row-pass' : s.result === 'FAIL' ? 'fk-row-fail' : ''}">
                      <td>${isFirstOfGroup ? `S${pad2(s.parsed.sampleNumber)}` : ""}</td>
                      <td>T${pad2(s.parsed.testNumber)}</td>
                      <td>${s.elevation || ""}</td>
                      <td>${s.window_type || ""}</td>
                      <td class="${s.result === 'PASS' ? 'fk-result-pass' : s.result === 'FAIL' ? 'fk-result-fail' : ''}">
                        ${s.result || ""}
                      </td>

                      <td>
                        ${groupFlags
                          .map(f => `<span class="fk-qa-flag" data-flag="${f}">${f}</span>`)
                          .join(" ")}
                      </td>
                      <td><button class="fk-sample-edit" data-id="${s.sample_id}">✎</button></td>
                      <td><button class="fk-sample-open" data-id="${s.sample_id}">→</button></td>
                      <td><button class="fk-sample-retest" data-id="${s.sample_id}">⟳</button></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

        </div>
      `;
        // -----------------------------
        // COLLAPSIBLE VISIT CARD
        // -----------------------------
        const toggleBtn = card.querySelector(".fk-visit-toggle");
        const body = card.querySelector(".fk-visit-body");
        card.querySelector(".fk-visit-body").classList.add("collapsed");
        card.querySelector(".fk-visit-toggle").classList.add("rotated");

        toggleBtn.addEventListener("click", () => {
        const isCollapsed = body.classList.toggle("collapsed");
        toggleBtn.classList.toggle("rotated", isCollapsed);
        });
      // -----------------------------
      // OPEN SAMPLE PAGE
      // -----------------------------
      card.querySelectorAll(".fk-sample-open").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          window.location.href = `sample.html?sample_id=${encodeURIComponent(id)}`;
        });
      });

      // -----------------------------
      // ADD SAMPLE
      // -----------------------------
      card.querySelector(".fk-add-sample-btn").addEventListener("click", async () => {
        const windowType = prompt("Window Type (SLDR, FIXD, AWNG, etc.):");
        if (!windowType) return;

        const visitId = visit.visit_id;
        const sampleId = generateSampleId(visitId, windowType);

        const sample = {
          sample_id: sampleId,
          visit_id: visitId,
          project_id: project.project_id,
          window_type: windowType,
          sample_number: parseInt(sampleId.match(/S(\d{2})/)[1], 10),
          test_number: 1,
          elevation: "",
          product_type: "",
          manufacturer: "",
          result: "",
          notes: "",
          attachments: []
        };

        SAMPLES.push(sample);
        visit.sample_ids.push(sampleId);

        await saveJSON("data/samples.json", { samples: SAMPLES });
        await saveJSON("data/visits.json", { visits: VISITS });

        const visits = await loadVisits();
        const samples = await loadSamples();
        renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
      });

      // -----------------------------
      // EDIT VISIT
      // -----------------------------
      card.querySelector(".fk-edit-visit-btn").addEventListener("click", () => {
        openVisitEditModal(visit, project);
      });

      // -----------------------------
      // RETEST
      // -----------------------------
      card.querySelectorAll(".fk-sample-retest").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const sample = SAMPLES.find(s => s.sample_id === id);

          // -----------------------------------------
          // STERN WARNING: Retesting a PASSED sample
          // -----------------------------------------
          if (sample.result === "PASS") {
            const proceed = confirm(
              "⚠️ WARNING: This sample previously PASSED.\n\n" +
              "Retesting a passing sample is unusual and should only be done if:\n" +
              "• Test pressure changed\n" +
              "• Installation detail changed\n" +
              "• Technician or PM explicitly requested it\n\n" +
              "Are you sure you want to create a retest?"
            );
            if (!proceed) return;
          }


          const nextTest = sample.test_number + 1;
          const newId = `${sample.visit_id}-${sample.window_type}-S${pad2(sample.sample_number)}T${pad2(nextTest)}`;

          const retest = {
            ...sample,
            sample_id: newId,
            test_number: nextTest,
            result: "",
            notes: ""
          };

          SAMPLES.push(retest);
          await saveJSON("data/samples.json", { samples: SAMPLES });

          const visits = await loadVisits();
          const samples = await loadSamples();
          renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
        });
      });

      // -----------------------------
      // INLINE EDITING
      // -----------------------------
      card.querySelectorAll(".fk-sample-edit").forEach(btn => {
        btn.addEventListener("click", () => {
          const row = btn.closest("tr");
          const sampleId = btn.dataset.id;
          const sample = SAMPLES.find(s => s.sample_id === sampleId);

          enterInlineEditMode(row, sample, project, visit);
        });
      });

      container.appendChild(card);
    });
}


// ---------------------------------------------------------
// INLINE EDIT MODE HANDLER
// ---------------------------------------------------------
function enterInlineEditMode(row, sample, project, visit) {
  row.innerHTML = `
    <td>${sample.sample_id}</td>
    <td><input id="edit-elevation" value="${sample.elevation || ""}" /></td>

    <td>
      <select id="edit-window-type">
        ${[
          "FIXD","AWNG","CASE","HUNG","SLDR","TILT","PCTR","PIVT",
          "CWOF","CWFX","WWAL","STFR","SING","DUBL","SLGD","TDRR"
        ]
          .map(t => `<option value="${t}" ${t === sample.window_type ? "selected" : ""}>${t}</option>`)
          .join("")}
      </select>
    </td>

    <td>
      <select id="edit-result">
        <option value="PASS" ${sample.result === "PASS" ? "selected" : ""}>PASS</option>
        <option value="FAIL" ${sample.result === "FAIL" ? "selected" : ""}>FAIL</option>
      </select>
    </td>

    <td><button class="fk-save-inline">Save</button></td>
    <td><button class="fk-cancel-inline">Cancel</button></td>
    <td></td>
  `;

  // SAVE
  row.querySelector(".fk-save-inline").addEventListener("click", async () => {
    sample.elevation = document.getElementById("edit-elevation").value;
    sample.window_type = document.getElementById("edit-window-type").value;
    sample.result = document.getElementById("edit-result").value;

    await saveJSON("data/samples.json", { samples: SAMPLES });

    const visits = await loadVisits();
    const samples = await loadSamples();
    renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
  });

  // CANCEL
  row.querySelector(".fk-cancel-inline").addEventListener("click", async () => {
    const visits = await loadVisits();
    const samples = await loadSamples();
    renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));
  });
}


// ---------------------------------------------------------
// VISIT EDIT MODAL
// ---------------------------------------------------------
function openVisitEditModal(visit, project) {
  const modal = document.getElementById("visit-edit-modal");

  document.getElementById("edit-visit-date").value = visit.date;
  document.getElementById("edit-visit-type").value = visit.test_type;
  document.getElementById("edit-visit-notes").value = visit.notes || "";

  modal.classList.remove("hidden");

  document.getElementById("save-visit-btn").onclick = async () => {
    visit.date = document.getElementById("edit-visit-date").value;
    visit.test_type = document.getElementById("edit-visit-type").value;
    visit.notes = document.getElementById("edit-visit-notes").value;

    visit.full_name = `${visit.date} ${project.project_name} ${visit.visit_id}`;
    visit.folder_path = generateVisitFolderPath(project.project_id, visit.full_name);

    await saveJSON("data/visits.json", { visits: VISITS });

    const visits = await loadVisits();
    const samples = await loadSamples();
    renderVisitsForProject(project, visits, samples, document.getElementById("visit-list"));

    modal.classList.add("hidden");
  };

  document.getElementById("cancel-visit-btn").onclick = () => {
    modal.classList.add("hidden");
  };
}

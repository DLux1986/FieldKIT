// Simple static list — update as needed
const standards = [
  "AAMA 501.2-25 - Quality Assurance and Diagnostic Water Leakage.pdf",
  "AAMA 502-21 - Voluntary Specification for Field Testing of Newly Installed Fenestration Products.pdf",
  "AAMA 503-24 - Voluntary Specification for Field Testing of Newly Installed Storefronts, Curtain Walls and Sloped Glazing Systems.pdf",
  "ASTM E283_E283M-19 - Test Method for Determining Rate of Air Leakage Through Exterior Windows, Curtain Walls, and Doors Under Specified Pressure Differences Across the Specimen.pdf",
  "ASTM E331-00(2023) - Standard Test Method for Water Penetration of Exterior Windows, Skylights, Doors, and Curtain Walls by Uniform Static Air Pressure Difference.pdf",
  "ASTM E783-02(2018) - Test Method for Field Measurement of Air Leakage Through Installed Exterior Windows and Doors.pdf",
  "ASTM E1105-15(2023) - Test Method for Field Determination of Water Penetration of Installed Exterior Windows, Skylights, Doors, and Curtain Walls, by Uniform or Cyclic Static Air Pressure Difference.pdf",
];

const listEl = document.getElementById("standardsList");
const viewer = document.getElementById("pdfViewer");
const fsBtn = document.getElementById("fsBtn");

fsBtn.onclick = () => {
  if (viewer.requestFullscreen) viewer.requestFullscreen();
};

function loadList() {
  standards.forEach(file => {
    const item = document.createElement("div");
    item.className = "standards-item";
    item.textContent = file.replace(".pdf", "");
    item.onclick = () => openPDF(file);
    listEl.appendChild(item);
  });
}

function openPDF(filename) {
  viewer.src = `/assets/standards/${filename}`;
}

loadList();

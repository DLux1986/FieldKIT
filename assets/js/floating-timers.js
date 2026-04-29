document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("fk-floating-timers");
  const openBtn = document.getElementById("fk-floating-open");
  const closeBtn = document.getElementById("fk-floating-close");
  const header = panel.querySelector(".fk-floating-header");

  // Restore saved position
  const savedX = localStorage.getItem("fkTimersX");
  const savedY = localStorage.getItem("fkTimersY");
  if (savedX && savedY) {
    panel.style.left = savedX + "px";
    panel.style.top = savedY + "px";
  }

  // Open panel
  openBtn.onclick = () => {
    panel.classList.remove("hidden");
  };

  // Close panel
  closeBtn.onclick = () => {
    panel.classList.add("hidden");
  };

  // Dragging logic
  let offsetX = 0, offsetY = 0, dragging = false;

  header.addEventListener("mousedown", e => {
    dragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    panel.style.left = (e.clientX - offsetX) + "px";
    panel.style.top = (e.clientY - offsetY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;

    // Save position
    localStorage.setItem("fkTimersX", panel.offsetLeft);
    localStorage.setItem("fkTimersY", panel.offsetTop);
  });
});

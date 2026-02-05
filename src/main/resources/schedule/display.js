import {
  formatCell,
  cleanTxt,
  formatMillisTime,
  parseTimeToTodayMillis,
  formatClock,
  getColumnTiming,
  getColumnAbsoluteStart,
  getRemainingMs,
  formatMs,
  getElapsedMs,
  getDurationMs,
  getCumulativeOffsetMs, startTicker
} from "./utils.js?v=1";

let host = location.host;
if (location.toString().includes("RELOAD_ON_SAVE")) {
  host = "localhost"
}
const ws = new WebSocket("ws://" + host + "/schedule/ws");

let schedule = null;
let activeColumnId = null;

/* -------------------- WS -------------------- */

ws.onmessage = e => {
  const event = JSON.parse(e.data);
  console.log(event);

  switch (event.type.split(".").pop()) {

    case "Load":
      schedule = event.schedule;
      activeColumnId = schedule?.activeColumnId ?? null;
      render();
      break;

    case "ActiveColumnChanged":
      activeColumnId = event.columnId;

      if (schedule?.columns) {
        const col = schedule.columns.find(c => c.id === event.columnId);
        if (col) {
          col.activatedAt = event.activatedAt;
        }
      }

      render();
      break;

    case "ColumnEdited":
      applyEdit(event);
      render();
      break;
  }
};

/* -------------------- AUTO RENDER -------------------- */

startTicker(250, () => render())

/* -------------------- TIMING -------------------- */

function getProgressPercent(col) {
  const duration = getDurationMs(col);
  if (!duration || duration <= 0) return 0;

  const elapsed = getElapsedMs(col);
  return getProgress(duration, elapsed)
}
function getProgress(duration, elapsed) {
  return (elapsed / duration) * 100; // allow >100 when late
}

/* -------------------- EDIT -------------------- */

function applyEdit(event) {
  if (!schedule?.columns) return;

  const col = schedule.columns.find(c => c.id === event.columnId);
  if (!col) return;

  col.cells = col.cells || {};
  col.cells[event.key] = event.value;
}

/* -------------------- RENDER -------------------- */

function render() {
  if (!schedule || !schedule.columns) return;

  const titleEl = document.getElementById("title");
  const timingEl = document.getElementById("timing");
  const progressEl = document.getElementById("progress");
  const ipContainer = document.getElementById("ipContainer");
  const tinyIdEl = document.getElementById("tinyId");
  const notesEl = document.getElementById("notes");

  const col = schedule.columns.find(c => c.id === activeColumnId);

  const t = getColumnTiming(col, schedule)

  if (!col) {
    tinyIdEl.textContent = "—";
    titleEl.textContent = "No Active Column";
    timingEl.textContent = "--:--";
    timingEl.className = "timing";
    if (progressEl) progressEl.style.width = "0%";
    return;
  }
  titleEl.textContent = cleanTxt(col.title) ?? "";

  const remaining = getRemainingMs(col);

  const notes = col.cells["posisjon"]?.value;
  notesEl.textContent = cleanTxt(notes)


  titleEl.textContent =
      cleanTxt(col.title)

  /* -------- ips -------- */

  ipContainer.innerHTML = "";

  const ip1 = col.cells["ip1"]?.value;
  const ip2 = col.cells["ip2"]?.value;

  console.log(col)

  function createIpBox(txt) {
    const box = document.createElement("div");
    box.className = "ip-box " + txt.toLowerCase().replace(" ", "");
    box.textContent = txt.toUpperCase();
    return box;
  }

  if (ip1) ipContainer.appendChild(createIpBox(ip1));
  if (ip2) ipContainer.appendChild(createIpBox(ip2));

  if (!ip1 && !ip2) {
    const box = createIpBox("—");
    ipContainer.appendChild(box);
  }

  /* -------- Tiny Column ID -------- */

  tinyIdEl.textContent = col.id ?? "—";

  /* -------- Progress -------- */

  if (progressEl) {
    const elapsed = getElapsedMs(col);
    const duration = col.duration;

    const percent = getProgress(duration, elapsed+1000);
    progressEl.style.width = Math.min(percent, 100) + "%";

    if (remaining < 0) {
      progressEl.classList.add("late");
      progressEl.classList.remove("ontime")
    } else {
      progressEl.classList.remove("late");
      progressEl.classList.add("ontime")
    }
  }

  /* -------- Timing Text -------- */

  timingEl.className = "timing";

  if (remaining == null) {
    timingEl.textContent = "--:--";
    return;
  }

  if (remaining >= 0) {
    timingEl.textContent = formatMs(remaining);
    timingEl.classList.add("ontime");
  } else {
    timingEl.textContent = "-" + formatMs(Math.abs(remaining));
    timingEl.classList.add("late");
  }
}
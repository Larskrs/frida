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

  const idEl = document.getElementById("colId");
  const titleEl = document.getElementById("title");
  const timingEl = document.getElementById("timing");
  const progressEl = document.getElementById("progress");
  const delayEl = document.getElementById("delay")

  const col = schedule.columns.find(c => c.id === activeColumnId);

  const t = getColumnTiming(col, schedule)

  if (!col) {
    idEl.textContent = "—";
    titleEl.textContent = "No Active Column";
    timingEl.textContent = "--:--";
    timingEl.className = "timing";
    if (progressEl) progressEl.style.width = "0%";
    return;
  }
    console.log(col.cells)
  idEl.textContent = col.cells["ip1"]?.value ?? col.cells["ip2"]?.value ?? col.cells["type"]?.value ?? col.id ?? "—";
  titleEl.textContent = cleanTxt(col.title) ?? "";

  const remaining = getRemainingMs(col);

  /* --------- Delay ---------- */

  delayEl.textContent = formatClock(t.remaining)

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
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
  getCumulativeOffsetMs, startTicker, createIpBox
} from "./utils.js?v=1";

let ws = null;
let reconnectTimer = null;

function connectWs() {
  let host = location.host;
  if (location.toString().includes("RELOAD_ON_SAVE")) {
    host = "localhost";
  }

  console.log("WS: connecting...");
  ws = new WebSocket("ws://" + host + "/schedule/ws");

  ws.onopen = () => {
    console.log("WS: connected");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = e => {
    const event = JSON.parse(e.data);
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
          if (col) col.activatedAt = event.activatedAt;
        }

        render();
        break;

      case "ColumnEdited":
        applyEdit(event);
        render();
        break;
    }
  };

  ws.onerror = err => {
    console.warn("WS: error", err);
    // onclose will handle reconnect
  };

  ws.onclose = () => {
    console.warn("WS: closed — retrying in 10s");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return; // already waiting

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, 10_000);
}

// start first connection
connectWs();

let schedule = null;
let activeColumnId = null;

/* -------------------- WS -------------------- */

ws.onmessage = e => {
  const event = JSON.parse(e.data);
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
  const offsetTimeEl = document.getElementById("offsetTime");
  const notesEl = document.getElementById("notes");

  const now = Date.now();
  const programStart = schedule.programStart ?? null;

  let col = schedule.columns.find(c => c.id === activeColumnId);

  // PRE-START MODE
  const isPreStart =
      programStart &&
      !activeColumnId &&
      schedule.columns.length > 0 &&
      now < programStart;

  if (isPreStart) {
    col = schedule.columns[0];
  }

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

  const notes = col.cells?.["stikkord"]?.value ?? "";
  console.log(`notes: ${notes}`)
  notesEl.textContent = cleanTxt(notes)


  titleEl.textContent =
      cleanTxt(col.title)

  /* -------- ips -------- */

  ipContainer.innerHTML = "";

// Define which cell keys should render as IP boxes
// You can add as many as you want here
  const ipKeys = [
    "ip1",
    "ip2",
    "variant",
  ];

  let foundAny = false;

  for (const key of ipKeys) {
    const value = col.cells[key]?.value;
    if (!value) continue;

    // Support comma-separated lists too
    const values = String(value)
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);

    for (const v of values) {
      ipContainer.appendChild(createIpBox(v));
      foundAny = true;
    }
  }

// Fallback if nothing rendered
  if (!foundAny) {
    ipContainer.appendChild(createIpBox("—"));
  }

  /* -------- Tiny Column ID -------- */

  tinyIdEl.textContent = col.id ?? "—";

  /* -------- Offset time -------- */

  offsetTimeEl.classList.remove("early", "late", "ontime");

  if (!t.abs) {
    offsetTimeEl.textContent = "-";
  } else if (t.delay === 0) {
    offsetTimeEl.textContent = "ON TIME";
    offsetTimeEl.classList.add("ontime");
  } else {
    const sign = t.delay > 0 ? "+" : "-"
    offsetTimeEl.textContent = `${sign}${formatMillisTime(Math.abs(t.delay))}`;
  }

  if (t.delay > 0) offsetTimeEl.classList.add("late");
  if (t.delay < 0) offsetTimeEl.classList.add("early");


  /* -------- Progress -------- */

  if (progressEl) {
    const elapsed = getElapsedMs(col);
    const duration = col.duration;

    const percent = getProgress(duration, elapsed);
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
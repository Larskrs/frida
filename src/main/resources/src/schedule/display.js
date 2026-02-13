import {
  formatCell,
  cleanTxt,
  formatMillisTime,
  parseTimeToTodayMillis,
  formatClock,
  getRowTiming,
  getRowAbsoluteStart,
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
        activeRowId = schedule?.activeRowId ?? null;
        render();
        break;

      case "ActiveRowChanged":
        activeRowId = event.rowId;

        if (schedule?.rows) {
          const row = schedule.rows.find(c => c.id === event.rowId);
          if (row) row.activatedAt = event.activatedAt;
        }

        render();
        break;

      case "rowEdited":
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
let activeRowId = null;

/* -------------------- WS -------------------- */

ws.onmessage = e => {
  const event = JSON.parse(e.data);
  switch (event.type.split(".").pop()) {

    case "Load":
      schedule = event.schedule;
      activeRowId = schedule?.activeRowId ?? null;
      render();
      break;

    case "ActiveRowChanged":
      activeRowId = event.rowId;

      if (schedule?.rows) {
        const row = schedule.rows.find(c => c.id === event.rowId);
        if (row) {
          row.activatedAt = event.activatedAt;
        }
      }

      render();
      break;

    case "rowEdited":
      applyEdit(event);
      render();
      break;
  }
};

/* -------------------- AUTO RENDER -------------------- */

startTicker(250, () => render())

/* -------------------- TIMING -------------------- */

function getProgressPercent(row) {
  const duration = getDurationMs(row);
  if (!duration || duration <= 0) return 0;

  const elapsed = getElapsedMs(row);
  return getProgress(duration, elapsed)
}
function getProgress(duration, elapsed) {
  return (elapsed / duration) * 100; // allow >100 when late
}

/* -------------------- EDIT -------------------- */

function applyEdit(event) {
  if (!schedule?.rows) return;

  const row = schedule.rows.find(c => c.id === event.rowId);
  if (!row) return;

  row.cells = row.cells || {};
  row.cells[event.key] = event.value;
}

function getActiveIndex() {
  if (!schedule?.rows?.length) return -1;

  if (activeRowId) {
    return schedule.rows.findIndex(c => c.id === activeRowId);
  }

  // Pre-start fallback
  const now = Date.now();
  const programStart = schedule.programStart ?? null;
  if (programStart && now < programStart) return 0;

  return 0;
}

/* -------------------- RENDER -------------------- */

function render() {
  if (!schedule || !schedule.rows) return;

  const titleEl = document.getElementById("title");
  const timingEl = document.getElementById("timing");
  const progressEl = document.getElementById("progress");
  const ipContainer = document.getElementById("ipContainer");
  const pageEl = document.getElementById("tinyId");
  const offsetTimeEl = document.getElementById("offsetTime");
  const notesEl = document.getElementById("notes");
  const detailsContainer = document.getElementById("details")

  const now = Date.now();
  const programStart = schedule.programStart ?? null;

  let row = schedule.rows.find(c => c.id === activeRowId);

  // PRE-START MODE
  const isPreStart =
      programStart &&
      !activeRowId &&
      schedule.rows.length > 0 &&
      now < programStart;

  if (isPreStart) {
    row = schedule.rows[0];
  }

  const t = getRowTiming(row, schedule)

  if (!row) {
    pageEl.textContent = "—";
    titleEl.textContent = "No Active row";
    timingEl.textContent = "--:--";
    timingEl.className = "timing";
    if (progressEl) progressEl.style.width = "0%";
    return;
  }
  titleEl.textContent = cleanTxt(row.title) ?? "";

  const remaining = getRemainingMs(row);

  const notes = row.cells?.["stikkord"]?.value ?? "";
  console.log(`notes: ${notes}`)
  notesEl.textContent = cleanTxt(notes)


  titleEl.textContent =
      cleanTxt(row.title)

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
    const value = row.cells[key]?.value;
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

  /* -------- Page -------- */

  pageEl.textContent = row.page ?? "—";

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
    const elapsed = getElapsedMs(row);
    const duration = row.duration;

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
    timingEl.textContent = formatClock(remaining);
    timingEl.classList.add("ontime");
  } else {
    timingEl.textContent = "-" + formatClock(Math.abs(remaining));
    timingEl.classList.add("late");
  }

  renderUpcoming();
}

function renderUpcoming() {
  const container = document.getElementById("upcomingContainer");
  if (!container || !schedule?.rows) return;

  container.innerHTML = "";

  const activeIndex = getActiveIndex();
  if (activeIndex < 0) return;

  const upcoming = schedule.rows.slice(activeIndex + 1);

  console.log(upcoming)

  for (const row of upcoming) {
    const rowEl = document.createElement("tr");
    rowEl.className = "upcoming-row";

    const ipContainer = document.createElement("td");
    ipContainer.className = "upcoming-ips";


    const page = document.createElement("td");
    page.className = "upcoming-page";
    page.textContent = cleanTxt(row.page);

    const title = document.createElement("td");
    title.className = "upcoming-title";
    title.textContent = cleanTxt(row.title);

    if (row.cells?.["Break"]?.value == 1) {
      rowEl.className = "upcoming-row break"
    }

    const time = document.createElement("td");
    time.className = "upcoming-time";

    const absStart = getRowAbsoluteStart(row, schedule);
    const t = getRowTiming(row, schedule)
    if (!absStart) {
      time.textContent = "--:--";
    } else {
      const msUntil = absStart - Date.now();
      time.textContent =
          msUntil > 0
              ? formatClock(msUntil)
              : "-" + formatClock(Math.abs(msUntil));
    }

    rowEl.appendChild(page)
    rowEl.appendChild(title);
    rowEl.appendChild(time);
    container.appendChild(rowEl);
  }
}

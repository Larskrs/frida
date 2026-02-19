import {
  cleanTxt,
  formatMillisTime,
  formatClock,
  getRowTiming,
  getRowAbsoluteStart,
  getRemainingMs,
  getElapsedMs,
  getDurationMs,
  startTicker,
  createIpBox
} from "./utils.js?v=2";

const WS_PATH = "/schedule/ws";
const RECONNECT_DELAY = 5000;

const Events = {
  REQUEST_LOAD: "com.example.websocket.ScheduleEvent.RequestLoad",
};

const state = {
  ws: null,
  reconnectTimer: null,
  schedule: null,
  activeRowId: null,
};

const urlParams = new URLSearchParams(window.location.search);

/* ---------------- WS ---------------- */

function getHost() {
  if (location.toString().includes("RELOAD_ON_SAVE")) return "localhost";
  return location.host;
}

function sendWs(payload) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function connectWs(scheduleId) {
  const ws = new WebSocket(`ws://${getHost()}${WS_PATH}/${scheduleId}`);
  state.ws = ws;

  ws.onopen = () => {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    sendWs({
      type: Events.REQUEST_LOAD,
      scheduleId
    });
  };

  ws.onmessage = e => {
    const event = safeJson(e.data);
    if (!event?.type) return;

    const type = event.type.split(".").pop();

    switch (type) {
      case "Load":
        state.schedule = event.schedule;
        state.activeRowId = event.schedule?.activeRowId ?? null;
        render();
        break;

      case "ActiveRowChanged":
        handleActiveChanged(event);
        break;

      case "RowEdited":
        applyRowPatch(event);
        break;

      case "RowCreate":
      case "RowDelete":
      case "StartProgramAtRow":
        // safest: reload entire schedule snapshot
        sendWs({
          type: Events.REQUEST_LOAD,
          scheduleId: state.schedule.id
        });
        break;
    }
  };

  ws.onclose = () => scheduleReconnect(scheduleId);
}

function scheduleReconnect(scheduleId) {
  if (state.reconnectTimer) return;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connectWs(scheduleId);
  }, RECONNECT_DELAY);
}

/* ---------------- EVENT HANDLERS ---------------- */

function handleActiveChanged(event) {
  const { rowId, activatedAt } = event;
  state.activeRowId = rowId;

  const row = state.schedule?.rows?.find(r => r.id === rowId);
  if (row) row.activatedAt = activatedAt;

  render();
}

function applyRowPatch(event) {
  const { rowId, key, value, cell } = event;
  const row = state.schedule?.rows?.find(r => r.id === rowId);
  if (!row) return;

  if (!cell) {
    row[key] = value;
  } else {
    if (!row.cells) row.cells = {};
    row.cells[key] = cell;
  }

  render();
}

/* ---------------- AUTO RENDER ---------------- */

startTicker(250, () => render());

/* ---------------- RENDER ---------------- */

function render() {
  if (!state.schedule?.rows) return;

  const titleEl = document.getElementById("title");
  const timingEl = document.getElementById("timing");
  const progressEl = document.getElementById("progress");
  const ipContainer = document.getElementById("ipContainer");
  const pageEl = document.getElementById("tinyId");
  const offsetTimeEl = document.getElementById("offsetTime");
  const notesEl = document.getElementById("notes");

  const schedule = state.schedule;
  const now = Date.now();

  let row = schedule.rows.find(r => r.id === state.activeRowId);

  const programStart = schedule.programStart ?? null;
  const isPreStart =
      programStart &&
      !state.activeRowId &&
      schedule.rows.length > 0 &&
      now < programStart;

  if (isPreStart) {
    row = schedule.rows[0];
  }

  if (!row) return;

  const t = getRowTiming(row, schedule);

  titleEl.textContent = cleanTxt(row.title ?? "");
  pageEl.textContent = row.page ?? "—";

  /* -------- Notes -------- */

  const notes = row.cells?.["stikkord"]?.value ?? "";
  notesEl.textContent = cleanTxt(notes);

  /* -------- IPs -------- */

  ipContainer.innerHTML = "";
  const ipKeys = ["ip1", "ip2"];
  let foundAny = false;

  for (const key of ipKeys) {
    const value = row.cells?.[key]?.value;
    if (!value) continue;

    const values = String(value)
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);

    for (const v of values) {
      ipContainer.appendChild(createIpBox(v));
      foundAny = true;
    }
  }

  if (!foundAny) {
    ipContainer.appendChild(createIpBox("—"));
  }

  /* -------- Offset -------- */

  offsetTimeEl.className = "";
  if (!t.abs) {
    offsetTimeEl.textContent = "-";
  } else if (t.delay === 0) {
    offsetTimeEl.textContent = "ON TIME";
    offsetTimeEl.classList.add("ontime");
  } else {
    const sign = t.delay > 0 ? "+" : "-";
    offsetTimeEl.textContent =
        `${sign}${formatMillisTime(Math.abs(t.delay))}`;
    offsetTimeEl.classList.add(t.delay > 0 ? "late" : "early");
  }

  /* -------- Progress -------- */

  const remaining = getRemainingMs(row);

  if (progressEl) {
    const elapsed = getElapsedMs(row);
    const duration = getDurationMs(row);

    const percent = duration > 0
        ? (elapsed / duration) * 100
        : 0;

    progressEl.style.width = Math.min(percent, 100) + "%";

    if (remaining < 0) {
      progressEl.classList.add("late");
    } else {
      progressEl.classList.remove("late");
    }
  }

  /* -------- Timing -------- */

  if (remaining == null) {
    timingEl.textContent = "--:--";
    return;
  }

  timingEl.className = "timing";

  if (remaining >= 0) {
    timingEl.textContent = formatClock(remaining);
    timingEl.classList.add("ontime");
  } else {
    timingEl.textContent =
        "-" + formatClock(Math.abs(remaining));
    timingEl.classList.add("late");
  }

  renderUpcoming();
}

/* ---------------- UPCOMING ---------------- */

function renderUpcoming() {
  const container = document.getElementById("upcomingContainer");
  if (!container || !state.schedule?.rows) return;

  container.innerHTML = "";

  const rows = state.schedule.rows;
  const activeIndex = rows.findIndex(r => r.id === state.activeRowId);

  const upcoming = activeIndex >= 0
      ? rows.slice(activeIndex + 1)
      : [];

  for (const row of upcoming) {
    const tr = document.createElement("tr");
    tr.className = "upcoming-row";

    const page = document.createElement("td");
    page.className = "upcoming-page";
    page.textContent = cleanTxt(row.page);

    const title = document.createElement("td");
    title.className = "upcoming-title";
    title.textContent = cleanTxt(row.title);

    const time = document.createElement("td");
    time.className = "upcoming-time";

    const absStart = getRowAbsoluteStart(row, state.schedule);

    if (!absStart) {
      time.textContent = "--:--";
    } else {
      const msUntil = absStart - Date.now();
      time.textContent =
          msUntil > 0
              ? formatClock(msUntil)
              : "-" + formatClock(Math.abs(msUntil));
    }

    if (row.cells?.["Break"]?.value == 1) {
      tr.classList.add("break");
    }

    tr.appendChild(page);
    tr.appendChild(title);
    tr.appendChild(time);
    container.appendChild(tr);
  }
}

/* ---------------- UTIL ---------------- */

function safeJson(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}

/* ---------------- INIT ---------------- */

const scheduleId = urlParams.get("id");
if (scheduleId) connectWs(scheduleId);

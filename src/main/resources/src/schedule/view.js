import {
    formatCell,
    cleanTxt,
    formatMillisTime,
    parseTimeToTodayMillis,
    formatClock,
    getRowTiming,
    getRowAbsoluteStart,
    getDurationMs,
    getCumulativeOffsetMs, millisSince, startTicker
} from "./utils.js?v=1";
var ws = null

const urlParams = new URLSearchParams(window.location.search)

function connectWs() {
    let host = location.host;
    if (location.toString().includes("RELOAD_ON_SAVE")) {
        host = "localhost";
    }

    console.log("WS: connecting...");
    ws = new WebSocket("ws://" + host + "/schedule/ws");

    ws.onopen = () => {
        console.log("WS: connected");
        windowDisconnected.style.display = "none"
        tableWrapper.style.display = "flex"
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (urlParams.has("id")) {
            const id = Number(urlParams.get("id")) ?? 0
            if (id === 0) return

            ws.send(JSON.stringify({
                type: "com.example.websocket.ScheduleEvent.RequestLoad",
                scheduleId: id
            }))
        }

    };
}

connectWs()

let reconnectTimer = null;

let schedule = null;
let activeRowId = null;

/* ---------------- Static Elements --------- */

    const table = document.getElementById("scheduleTable");
    const tableWrapper = document.getElementById("schedule-wrapper")
    const windowNoSchedule = document.getElementById("window-no-shedule")
    const windowDisconnected = document.getElementById("window-disconnected")

    const metadataTitle = document.getElementById("head-title")

import "./components/contextMenu.js"
import {contextMenu, showContextMenu} from "./components/contextMenu.js";


/* -------------------- WS -------------------- */

function scheduleReconnect() {
    if (reconnectTimer) return; // already waiting

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWs();
    }, 1_000);
}

ws.onmessage = e => {
    const event = JSON.parse(e.data);
    console.log(event)

    switch (event.type.split(".").pop()) {
        case "ProgramStartChanged":
            if (schedule) {
                schedule.programStart = event.programStart;
            }
            render();
            break;
        case "Load":
            console.log("Attempting to load schedule");
            schedule = event.schedule;
            activeRowId = schedule?.activeRowId ?? null;
            console.log(schedule)
            metadataTitle.innerHTML = schedule?.name
            console.log(schedule)

            if (schedule?.rows.length <= 0) {
                windowNoSchedule.style.display = "flex"
                tableWrapper.style.display = "none"
            } else {
                windowNoSchedule.style.display = "none"
                tableWrapper.style.display = "flex"
            }
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

ws.onclose = e => {

    windowDisconnected.style.display = "flex"
    windowNoSchedule.style.display = "none"
    tableWrapper.style.display = "none"

    console.warn("WS: closed — retrying in 10s");
    scheduleReconnect();

}


const startInput = document.getElementById("program-start-input");
const startNowBtn = document.getElementById("program-start-now");
const startSetBtn = document.getElementById("program-start-set");

startNowBtn?.addEventListener("click", () => {
    const now = Date.now();
    sendProgramStart(0);

    // also update input visually
    const d = new Date(now);
    startInput.value =
        d.toTimeString().split(" ")[0]; // HH:MM:SS
});

startSetBtn?.addEventListener("click", () => {
    if (!startInput.value) return;
    const ms = parseTimeToTodayMillis(startInput.value);
    sendProgramStart(ms);
});

function sendProgramStart(ms) {
    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.ProgramStartChanged",
        programStart: ms,
        scheduleId: schedule.id
    }));
}

document.getElementById("select-schedule-load")
    .addEventListener("selected", e => {
        console.log("User picked:", e.detail);
        console.log("Attempting to load schedule ")

        ws.send(JSON.stringify({
            type: "com.example.websocket.ScheduleEvent.RequestLoad",
            scheduleId: Number(e.detail.id)
        }))
    });


/* -------------------- TIMING -------------------- */

// Duration is stored in cells["duration"].value in SECONDS

// Sum all durations ABOVE this row

/* -------------------- EDITS -------------------- */

function applyEdit(event) {
    const row = schedule.rows.find(c => c.id === event.rowId);
    if (!row) return;
    row.cells[event.key] = event.value;
}

function startHere(rowId) {
    const row = schedule.rows.find(r => r.id === rowId);
    if (!row) {alert("Could not find the rowId, try refreshing the page or contact support."); return}

    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.StartProgramAtRow",
        rowId,
        scheduleId: schedule.id
    }));
}


/* -------------------- INPUT -------------------- */

document.addEventListener("keydown", e => {
    if (!schedule) return;

    const idx = schedule.rows.findIndex(c => c.id === activeRowId);
    if (idx === -1) return;

    if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault()
        setActiveIndex(idx + 1);

    }

    if (e.key === "ArrowUp") {
        setActiveIndex(idx - 1);
    }
});

function setActiveIndex(newIndex) {
    if (!schedule) return;
    if (newIndex < 0 || newIndex >= schedule.rows.length) return;

    setActive(schedule.rows[newIndex].id);
}

function setActive(rowId) {
    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.ActiveRowChanged",
        rowId,
        scheduleId: schedule.id
    }));
}

function deleteFn (rowId) {
    schedule.rows = schedule.rows.filter((row) => row.id !== rowId)
    render()
}

/* -------------------- RENDER -------------------- */

function render() {
    table.innerHTML = "";

    if (!schedule) return;

    const activeLabel = document.getElementById("active-row");
    const activeItem = schedule.rows.find(c => c.id === activeRowId);

    if (!activeItem) {
        activeLabel.textContent = "No row selected";
    } else {
        const t = getRowTiming(activeItem, schedule);
        activeLabel.textContent =
            `${activeItem.id} - ${cleanTxt(activeItem.title)} - ${formatMillisTime(t.remaining)}`;
    }

    // Program start label (optional)
    const startLabel = document.getElementById("program-start");
    if (startLabel && schedule.programStart) {
        startLabel.textContent =
            "Program Start: " + formatClock(schedule.programStart);
    }

    const hiddenKeys = new Set(["Break"]);
    const keys = new Set(["page", "title", "status", "duration", "delay"]);

    schedule.rows.forEach(row =>
        Object.keys(row.cells || {}).forEach(raw => {
            if (!hiddenKeys.has(cleanTxt(raw))) {
                keys.add(cleanTxt(raw))
            }
        })
    );

    // Header
    const headerRow = document.createElement("tr");
    keys.forEach(key => {
        const th = document.createElement("th");
        th.textContent = key.toUpperCase();
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Placeholder row if no active row
    if (!activeItem) {
        const row = document.createElement("tr");
        row.classList.add("placeholder-row");

        keys.forEach((key, i) => {
            const td = document.createElement("td");

            if (i === 0) {
                td.textContent = "-";
            } else if (key === "title") {
                td.textContent = "No row selected – waiting for input from script";
            } else {
                td.textContent = "";
            }

            switch (key.toLowerCase()) {

            }

            row.appendChild(td);
        });

        table.appendChild(row);
    }

    // Rows
    schedule.rows.forEach(row => {
        const rowEl = document.createElement("tr");
        rowEl.id = row.id

        rowEl.addEventListener("contextmenu", e => {
            e.preventDefault();

            showContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                    { label: "Open", action: () => console.log("open") },
                    //{ label: "Rename", action: renameFn },
                    { type: "separator" },
                    { label: "Delete", action: () => deleteFn(row.id), danger: true },
                    { label: "Start Program now", action: () => startHere(row.id) },
                ]
            });
        });

        if (row.id === activeRowId) {
            rowEl.classList.add("active");
        }

        if (row.cells?.["Break"]?.value === 1) {
            rowEl.classList.add("break")
        }

        rowEl.addEventListener("click", () => setActive(row.id));

        keys.forEach(key => {
            const td = document.createElement("td");

            if (key === "page") {
                td.textContent = row.page;

            } else if (key === "title") {
                td.textContent = cleanTxt(row.title);

            } else if (key === "start") {
                const t = getRowTiming(row, schedule);
                td.textContent = t.abs ? formatClock(t.abs) : "-";

            } else if (key === "status") {
                const t = getRowTiming(row, schedule);
                td.textContent = t.status;

                td.classList.remove("upcoming", "ontime", "late", "overdue");
                if (t.status === "UPCOMING") td.classList.add("upcoming");
                if (t.status === "ON TIME") td.classList.add("ontime");
                if (t.status === "LATE") td.classList.add("late");
                if (t.status === "OVERDUE") td.classList.add("late");

            } else if (key === "duration") {
                const t = getRowTiming(row, schedule)
                const activeIndex = schedule.rows.findIndex(c => c.id === activeRowId);
                const idx = schedule.rows.findIndex(c => c.id === row.id);
                if (activeRowId !== row.id) {
                    td.textContent = formatMillisTime(t.duration)
                } else if (t.remaining > 0) {
                    td.textContent = formatMillisTime(t.remaining)
                }
            } else if (key === "delay") {
                  const t = getRowTiming(row, schedule);

                  if (!t.abs) {
                      td.textContent = "-";
                  } else if (t.delay === 0) {
                      td.textContent = "00:00";
                  } else {
                      const sign = t.delay > 0 ? "+" : "-"
                      td.textContent = `${sign}${formatMillisTime(Math.abs(t.delay))}`;
                  }

                  td.classList.remove("early", "late");
                  if (t.delay > 0) td.classList.add("late");
                  if (t.delay < 0) td.classList.add("early");


            } else {
                td.textContent = formatCell(row.cells?.[key]);
            }

            rowEl.appendChild(td);
        });

        table.appendChild(rowEl);
    });
}

// Re-render clock every second
startTicker(1000, () => render())


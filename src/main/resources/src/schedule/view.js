import {
    formatCell,
    cleanTxt,
    formatMillisTime,
    parseTimeToTodayMillis,
    formatClock,
    getRowTiming,
    startTicker
} from "./utils.js?v=2";

import "./components/contextMenu.js";
import { showContextMenu } from "./components/contextMenu.js";

/* -------------------- CONSTANTS -------------------- */

const WS_PATH = "/schedule/ws";
const RECONNECT_DELAY = 1000;

const Events = {
    REQUEST_LOAD: "com.example.websocket.ScheduleEvent.RequestLoad",
    PROGRAM_START: "com.example.websocket.ScheduleEvent.ProgramStartChanged",
    ACTIVE_ROW: "com.example.websocket.ScheduleEvent.ActiveRowChanged",
    ROW_EDIT: "com.example.websocket.ScheduleEvent.RowEdited",
    START_AT_ROW: "com.example.websocket.ScheduleEvent.StartProgramAtRow",
};

/* -------------------- STATE -------------------- */

const state = {
    ws: null,
    reconnectTimer: null,
    schedule: null,
    activeRowId: null,
    renderQueued: false,

    editMode: false,
    editingCell: null, // {rowId, key}
};

/* -------------------- DOM -------------------- */

const el = {
    table: document.getElementById("scheduleTable"),
    tableWrapper: document.getElementById("schedule-wrapper"),
    windowNoSchedule: document.getElementById("window-no-shedule"),
    windowDisconnected: document.getElementById("window-disconnected"),
    metadataTitle: document.getElementById("head-title"),
    startInput: document.getElementById("program-start-input"),
    startNowBtn: document.getElementById("program-start-now"),
    startSetBtn: document.getElementById("program-start-set"),
    activeLabel: document.getElementById("active-row"),
    startLabel: document.getElementById("program-start"),
};

const urlParams = new URLSearchParams(window.location.search);

/* -------------------- UTIL -------------------- */

function safeJson(str) {
    try { return JSON.parse(str); }
    catch { return null; }
}

function show(elm, v = true) {
    if (!elm) return;
    elm.style.display = v ? "flex" : "none";
}

function sendWs(payload) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify(payload));
}

/* -------------------- WS -------------------- */

function getHost() {
    if (location.toString().includes("RELOAD_ON_SAVE")) return "localhost";
    return location.host;
}

function connectWs() {
    const ws = new WebSocket(`ws://${getHost()}${WS_PATH}`);
    state.ws = ws;

    ws.onopen = () => {
        show(el.windowDisconnected, false);
        show(el.tableWrapper, true);

        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }

        if (urlParams.has("id")) {
            const id = Number(urlParams.get("id"));
            if (id > 0) {
                sendWs({
                    type: Events.REQUEST_LOAD,
                    scheduleId: id,
                });
            }
        }
    };

    ws.onmessage = e => {
        const event = safeJson(e.data);
        console.log({event})
        if (!event?.type) return;

        const type = event.type.split(".").pop();

        switch (type) {
            case "ProgramStartChanged":
                if (state.schedule) state.schedule.programStart = event.programStart;
                scheduleRender();
                break;

            case "Load":
                loadSchedule(event.schedule);
                break;

            case "ActiveRowChanged":
                state.activeRowId = event.rowId;
                updateActivated(event.rowId, event.activatedAt);
                scheduleRender();
                break;

            case "RowEdited":
            case "rowEdited":
                applyEdit(event);
                scheduleRender();
                break;
        }
    };

    ws.onclose = () => {
        show(el.windowDisconnected, true);
        show(el.tableWrapper, false);
        show(el.windowNoSchedule, false);
        scheduleReconnect();
    };
}

function scheduleReconnect() {
    if (state.reconnectTimer) return;
    state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connectWs();
    }, RECONNECT_DELAY);
}

/* -------------------- SCHEDULE -------------------- */

function loadSchedule(schedule) {
    console.log("LoadSchedule Event Loaded")
    console.log(schedule)
    state.schedule = schedule;
    state.activeRowId = schedule?.activeRowId ?? null;

    if (el.metadataTitle) el.metadataTitle.textContent = schedule?.name ?? "";

    const hasRows = schedule?.rows?.length > 0;
    show(el.windowNoSchedule, !hasRows);
    show(el.tableWrapper, hasRows);

    scheduleRender();
}

function updateActivated(rowId, activatedAt) {
    const row = state.schedule?.rows?.find(r => r.id === rowId);
    if (row) row.activatedAt = activatedAt;
}

/* -------------------- INPUT -------------------- */

document.addEventListener("keydown", e => {
    if (!state.schedule) return;

    const idx = state.schedule.rows.findIndex(r => r.id === state.activeRowId);
    if (idx === -1) return;

    if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setActiveIndex(idx + 1);
    }

    if (e.key === "ArrowUp") {
        setActiveIndex(idx - 1);
    }
});

/* -------------------- ACTIONS -------------------- */

function setActiveIndex(i) {
    const rows = state.schedule?.rows;
    if (!rows || i < 0 || i >= rows.length) return;
    setActive(rows[i].id);
}

function setActive(rowId) {
    sendWs({
        type: Events.ACTIVE_ROW,
        rowId,
        scheduleId: state.schedule.id,
    });
}

function startHere(rowId) {
    sendWs({
        type: Events.START_AT_ROW,
        rowId,
        scheduleId: state.schedule.id,
    });
}

/* -------------------- EDIT -------------------- */

function applyEdit(event) {
    const row = state.schedule?.rows?.find(r => r.id === event.rowId);
    if (!row) return;

    const key = event.key.toLowerCase();
    if (key === "title") row.title = event.value;
    else if (key === "page") row.page = event.value;
    else if (key === "duration") row.duration = Number(event.value);
    else row.cells[key] = event.value;
}

/* -------------------- RENDER -------------------- */

function scheduleRender() {
    if (state.renderQueued) return;
    if (state.editMode) return;

    state.renderQueued = true;
    requestAnimationFrame(() => {
        state.renderQueued = false;
        render();
    });
}

function render() {
    const { schedule, activeRowId } = state;
    if (!schedule || !el.table) return;

    el.table.innerHTML = "";

    const activeRow = schedule.rows.find(r => r.id === activeRowId);

    if (el.activeLabel) {
        if (!activeRow) el.activeLabel.textContent = "No row selected";
        else {
            const t = getRowTiming(activeRow, schedule);
            el.activeLabel.textContent =
                `${activeRow.id} - ${cleanTxt(activeRow.title)} - ${formatMillisTime(t.remaining)}`;
        }
    }

    if (el.startLabel && schedule.programStart) {
        el.startLabel.textContent = "Program Start: " + formatClock(schedule.programStart);
    }

    const keys = new Set(["page", "title", "status", "duration", "delay"]);

    schedule.rows.forEach(row =>
        Object.keys(row.cells || {}).forEach(k => keys.add(cleanTxt(k)))
    );

    const header = document.createElement("tr");
    keys.forEach(k => {
        const th = document.createElement("th");
        th.textContent = k.toUpperCase();
        header.appendChild(th);
    });
    el.table.appendChild(header);

    schedule.rows.forEach(row => {
        const tr = document.createElement("tr");
        if (row.id === activeRowId) tr.classList.add("active");

        tr.addEventListener("contextmenu", e => {
            e.preventDefault();
            showContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                    { label: "Activate Row", action: () => setActive(row.id) },
                    { type: "separator" },
                    { label: "Start Program now", action: () => startHere(row.id) },
                ],
            });
        });

        keys.forEach(key => {
            const td = document.createElement("td");

            td.addEventListener("click", () => state.editMode = true)

            const value =
                key === "title" ? cleanTxt(row.title) :
                    key === "page" ? row.page :
                        formatCell(row.cells?.[key]);

            if (!state.editMode) {
                td.textContent = value;
                tr.appendChild(td);
                return;
            }

            // ---- EDIT MODE ----
            const input = document.createElement("input");
            input.value = value ?? "";
            input.style.width = "100%";

            input.addEventListener("focus", () => {
                state.editingCell = { rowId: row.id, key };
            });

            input.addEventListener("blur", () => commitEdit(row.id, key, input.value));
            input.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    input.blur();
                }
                if (e.key === "Escape") {
                    render(); // revert
                }
            });

            td.appendChild(input);
            tr.appendChild(td);
        });

        el.table.appendChild(tr);
    });
}

document.getElementById("select-schedule-load")
    .addEventListener("selected", e => {
        console.log("User picked:", e.detail);
        console.log("Attempting to load schedule ")

        sendWs({
            type: Events.REQUEST_LOAD,
            scheduleId: Number(e.detail.id)
        })
    });

function commitEdit(rowId, key, value) {
    if (!state.schedule) return;

    const row = state.schedule.rows.find(r => r.id === rowId);
    if (!row) return;

    let finalValue = value;

    if (key === "duration") {
        finalValue = parseInt(value) || 0;
        row.duration = finalValue;
    } else if (key === "title") {
        row.title = value;
    } else if (key === "page") {
        row.page = value;
    } else {
        row.cells[key] = finalValue;
    }

    sendWs({
        type: Events.ROW_EDIT,
        rowId,
        key,
        value: finalValue,
        scheduleId: state.schedule.id,
    });
}


/* -------------------- TICKER -------------------- */

startTicker(1000, scheduleRender);

/* -------------------- INIT -------------------- */

connectWs();

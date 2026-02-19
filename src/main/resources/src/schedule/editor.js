import "./components/contextMenu.js";
import { showContextMenu } from "./components/contextMenu.js";
import {
    cleanTxt,
} from "./utils.js?v=2";

const WS_PATH = "/schedule/ws";
const RECONNECT_DELAY = 1000;

const Events = {
    REQUEST_LOAD: "com.example.websocket.ScheduleEvent.RequestLoad",
    ROW_EDIT: "com.example.websocket.ScheduleEvent.RowEdited",
    CREATE_ROW: "com.example.websocket.ScheduleEvent.RowCreate",
    DELETE_ROW: "com.example.websocket.ScheduleEvent.RowDelete",
    ACTIVE_CHANGED: "com.example.websocket.ScheduleEvent.ActiveRowChanged"
};

const state = {
    ws: null,
    reconnectTimer: null,
    schedule: null,
    previousRows: new Map(),
    columns: [],
    activeRowId: null,
};

const el = {
    body: document.getElementById("scheduleBody"),
    head: document.getElementById("scheduleHead"),
    // Windows
    windowNoSchedule: document.getElementById("window-no-shedule"),
    windowDisconnected: document.getElementById("window-disconnected"),
    // Links
    promptLink: document.getElementById("prompt-link"),
    // indicators
    websocketIndicator: document.getElementById("ws-indicator")
};

const urlParams = new URLSearchParams(window.location.search);

/* ---------------- WS ---------------- */

function getHost() {
    if (location.toString().includes("RELOAD_ON_SAVE")) return "localhost";
    console.log(location.host)
    return location.host;
}

function sendWs(payload) {
    if (state.ws?.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(payload));
    }
}

function handleActiveRowChanged(newRowId) {
    if (!newRowId) return;

    // Remove previous
    if (state.activeRowId !== null) {
        const prevEl = document.querySelector(
            `tr[data-row="${state.activeRowId}"]`
        );
        if (prevEl) prevEl.classList.remove("active");
    }

    // Add new
    const newEl = document.querySelector(
        `tr[data-row="${newRowId}"]`
    );
    if (newEl) newEl.classList.add("active");

    // Store
    state.activeRowId = newRowId;
}

function connectWs(scheduleId) {
    const url = `ws://${getHost()}${WS_PATH}/${scheduleId}`
    console.info(url)
    const ws = new WebSocket(url);
    state.ws = ws;

    ws.onopen = () => {
        el.windowDisconnected.style.display = "none";
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);

        const id = Number(urlParams.get("id") ?? 0);
        if (id > 0) {
            sendWs({ type: Events.REQUEST_LOAD, scheduleId: id });
        }

        el.websocketIndicator.style.setProperty('--status-hue', '150')
        el.websocketIndicator.textContent = "Listening for updates"
    };

    ws.onmessage = e => {
        const event = safeJson(e.data);
        if (!event?.type) return;

        const type = event.type.split(".").pop();

        if (type === "Load") {
            loadSchedule(event.schedule);
        }

        if (type === "RowEdited") {
            applyRowPatch(event);
        }

        if (type === "ActiveRowChanged") {
            handleActiveRowChanged(event.rowId);
        }
    };

    ws.onclose = scheduleReconnect;
}

function scheduleReconnect() {
    el.windowDisconnected.style.display = "block";
    if (state.reconnectTimer) return;

    state.reconnectTimer = setTimeout(connectWs, RECONNECT_DELAY);
    el.websocketIndicator.style.setProperty('--status-hue', '150')
    el.websocketIndicator.textContent = "Disconnected from server"
}

/* ---------------- LOAD / DIFF ---------------- */

function loadSchedule(schedule) {
    console.log(schedule);
    if (!schedule?.rows) return;

    state.schedule = schedule;

    el.promptLink.href = `/schedule/prompt.html?id=${schedule.id}`

    /* -------- HEADER / COLUMNS -------- */

    const newColumns = buildColumns(schedule);
    if (!columnsEqual(state.columns, newColumns)) {
        state.columns = newColumns;
        renderHeader(newColumns);
    }

    /* -------- ROW DIFF -------- */

    const newRows = new Map(schedule.rows.map(r => [r.id, r]));

    newRows.forEach((row, id) => {
        const old = state.previousRows.get(id);
        if (!old || !rowsEqual(old, row)) {
            renderRow(row);
        }
    });

    state.previousRows.forEach((_, id) => {
        if (!newRows.has(id)) removeRow(id);
    });

    state.previousRows = newRows;
}

function rowsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function setActive(rowId) {
    sendWs({
        type: Events.ACTIVE_CHANGED,
        rowId,
        scheduleId: state.schedule.id
    });
}

/* ---------------- ROW RENDER ---------------- */


function buildColumns(schedule) {
    const topFields = [["title", "Text"], ["page", "Text"], ["duration", "Time"]];
    const cellKeys = new Map();

    schedule.rows.forEach(row => {
        Object.keys(row.cells || {}).forEach(k => {
            cellKeys.set(   cleanTxt(k), row.cells[k].type);
        });
    });

    console.log(cellKeys)

    return [...topFields, ...Array.from(cellKeys)];
}

function columnsEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}


function renderHeader(columns) {
    if (!el.head) return;

    el.head.innerHTML = "";

    const tr = document.createElement("tr");

    columns.forEach(col => {
        const [key, type] = col
        const th = document.createElement("th");
        th.innerHTML = `<span>${key.toUpperCase()} <span class="type-name-label">${type}</span></span>`;
        tr.appendChild(th);
    });

    el.head.appendChild(tr);
}

function openScriptPage () {
    const sid = state.schedule?.id ?? 0;
    var strWindowFeatures = "location=yes,height=570,width=520,scrollbars=yes,status=yes"
    window.open(`/schedule/script.html?id=${sid}`, "_blank", strWindowFeatures);
}

function createRowBelow(currentOrder) {
    sendWs({
        type: Events.CREATE_ROW,
        scheduleId: state.schedule.id,
        order: currentOrder + 1
    });
}

function deleteRow(rowId) {
    sendWs({
        type: Events.DELETE_ROW,
        rowId,
        scheduleId: state.schedule.id
    })
}

function renderRow(row) {
    let tr = document.querySelector(`tr[data-row="${row.id}"]`);

    if (!tr) {
        tr = document.createElement("tr");
        tr.dataset.row = row.id;

        tr.addEventListener("contextmenu", e => {
            e.preventDefault()

            showContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                    { label: "Edit Script", action: () => openScriptPage() },
                    { label: "Set Active", action: () => setActive(row.id) },
                    //{ label: "Rename", action: renameFn },
                    { type: "separator" },
                    { label: "New Row Below", action: () => createRowBelow(row.order)},
                    { label: "Delete", action: () => deleteRow(row.id), danger: true}
                ]
            });
        })

        el.body.appendChild(tr);
    }

    tr.innerHTML = "";

    state.columns.forEach(([key, type]) => {
        const td = document.createElement("td");

        /* -------- TOP FIELDS -------- */

        if (["title","page","script","duration", "order"].includes(key)) {

            const input =
                key === "duration"
                    ? (() => {
                        const i = document.createElement("input");
                        i.type = "number";
                        i.value = row[key] ?? 0;
                        return i;
                    })()
                    : createTextInput(row[key]);

            input.onchange = () => {
                sendWs({
                    type: Events.ROW_EDIT,
                    scheduleId: state.schedule.id,
                    rowId: row.id,
                    key,
                    value: key === "duration" ? Number(input.value) : input.value,
                });
            };

            td.appendChild(input);
        }

        /* -------- CELLS -------- */

        else {
            const cell = row.cells?.[key];

            let input;

            if (cell) {
                // Existing typed cell
                input = createInputForCell(cell);
            } else {
                // Missing cell → empty text input
                input = document.createElement("input");
                input.type = "text";
                input.value = "";
            }

            input.onchange = () => {

                const value =
                    cell?.type === "Boolean"
                        ? input.checked
                        : cell?.type === "Number" || cell?.type === "Time"
                            ? Number(input.value)
                            : input.value;

                sendWs({
                    type: Events.ROW_EDIT,
                    scheduleId: state.schedule.id,
                    rowId: row.id,
                    key,
                    cell: {
                        // If no cell existed before, default to Text
                        type: cell?.type ?? "Text",
                        value: cleanTxt(value),
                    },
                });
            };
            td.appendChild(input);
        }

        tr.appendChild(td);
    });

}



function removeRow(id) {
    const tr = document.querySelector(`tr[data-row="${id}"]`);
    if (tr) tr.remove();
}

function createInputForCell(cell) {
    const input = document.createElement("input");

    switch (cell?.type) {
        case "Number":
            input.type = "number";
            input.value = cell.value ?? 0;
            break;

        case "Boolean":
            input.type = "checkbox";
            input.checked = !!cell.value;
            break;

        case "Time":
            input.type = "number";
            input.value = cell.millis ?? 0;
            break;

        default:
            input.type = "text";
            input.value = cell?.value ?? "";
    }

    return input;
}

function createTextInput(value) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    return input;
}

/* ---------------- PATCH ---------------- */

function applyRowPatch(event) {
    const { rowId, key, value, cell } = event;
    if (!rowId) return;

    const row = state.previousRows.get(rowId);
    if (!row) return;

    // ----- TOP LEVEL -----
    if (!cell) {
        row[key] = value;
    }

    // ----- CELL -----
    else {
        if (!row.cells) row.cells = {};
        row.cells[key] = cell;
    }

    // Store back
    state.previousRows.set(rowId, row);

    // Re-render only this row
    renderRow(row);
}


/* ---------------- UTILS ---------------- */

function safeJson(str) {
    try { return JSON.parse(str); }
    catch { return null; }
}



/* ---------------- INIT ---------------- */

const scheduleId = urlParams.get("id")
connectWs(scheduleId);


document.getElementById("select-schedule-load")
    .addEventListener("selected", e => {
        console.log("User picked:", e.detail);
        console.log("Attempting to disconnect from current Socket")

        const url = new URL(window.location.href);
        url.searchParams.set("id", e.detail.id);
        window.history.replaceState({}, "", url);
        state.ws.close()

        connectWs(e.detail.id)
    });
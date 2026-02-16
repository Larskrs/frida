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
};

const state = {
    ws: null,
    reconnectTimer: null,
    schedule: null,
    previousRows: new Map(),
    columns: []
};

const el = {
    body: document.getElementById("scheduleBody"),
    head: document.getElementById("scheduleHead"),
    windowNoSchedule: document.getElementById("window-no-shedule"),
    windowDisconnected: document.getElementById("window-disconnected"),
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

function connectWs() {
    const ws = new WebSocket(`ws://${getHost()}${WS_PATH}`);
    state.ws = ws;

    ws.onopen = () => {
        el.windowDisconnected.style.display = "none";
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);

        const id = Number(urlParams.get("id") ?? 0);
        if (id > 0) {
            sendWs({ type: Events.REQUEST_LOAD, scheduleId: id });
        }
    };

    ws.onmessage = e => {
        const event = safeJson(e.data);
        if (!event?.type) return;

        const type = event.type.split(".").pop();

        if (type === "Load") {
            loadSchedule(event.schedule);
        }

        if (type === "RowEdited") {
            applyRowPatch(event.row);
        }
    };

    ws.onclose = scheduleReconnect;
}

function scheduleReconnect() {
    el.windowDisconnected.style.display = "block";
    if (state.reconnectTimer) return;

    state.reconnectTimer = setTimeout(connectWs, RECONNECT_DELAY);
}

/* ---------------- LOAD / DIFF ---------------- */

function loadSchedule(schedule) {
    console.log(schedule);
    if (!schedule?.rows) return;

    state.schedule = schedule;

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
    window.open(`/script.php?id=${sid}`, "_blank", strWindowFeatures);
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
                    //{ label: "Rename", action: renameFn },
                    { type: "separator" },
                ]
            });
        })

        el.body.appendChild(tr);
    }

    tr.innerHTML = "";

    state.columns.forEach(([key, type]) => {
        const td = document.createElement("td");

        /* -------- TOP FIELDS -------- */

        if (["title","page","script","duration"].includes(key)) {

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

function applyRowPatch(row) {
    if (!row?.id) return;

    state.previousRows.set(row.id, row);
    renderRow(row);
}

/* ---------------- UTILS ---------------- */

function safeJson(str) {
    try { return JSON.parse(str); }
    catch { return null; }
}



/* ---------------- INIT ---------------- */

connectWs();

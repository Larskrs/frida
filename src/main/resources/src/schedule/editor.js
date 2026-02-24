import "./components/contextMenu.js";
import { showContextMenu } from "./components/contextMenu.js";
import {
    cleanTxt,
} from "./utils.js?v=2";
import { DurationInput, TimeInput } from "./components/time-input.js";
import {showToast} from "./components/toast.js";
import {WebSocketManager} from "./socket-manager.js";

const Events = {
    REQUEST_LOAD: "com.example.websocket.ScheduleEvent.RequestLoad",
    ROW_EDIT: "com.example.websocket.ScheduleEvent.RowEdited",
    CREATE_ROW: "com.example.websocket.ScheduleEvent.RowCreate",
    DELETE_ROW: "com.example.websocket.ScheduleEvent.RowDelete",
    ACTIVE_CHANGED: "com.example.websocket.ScheduleEvent.ActiveRowChanged",
    START_PROGRAM_AT_ROW: "com.example.websocket.ScheduleEvent.StartProgramAtRow"
};

const state = {
    schedule: null,
    previousRows: new Map(),
    columns: [],
    activeRowId: null,
    inputInstances: new Map()
};

const el = {
    body: document.getElementById("scheduleBody"),
    head: document.getElementById("scheduleHead"),
    // Windows
    windowDisconnected: document.getElementById("window-disconnected"),
    // Links
    promptLink: document.getElementById("prompt-link"),
    // indicators
    websocketIndicator: document.getElementById("ws-indicator"),
    // Buttons
    createRowBtn: document.getElementById("create-new-row"),
};


const urlParams = new URLSearchParams(window.location.search);

const nonInteractibleKeys = ["activatedAt"]


/* ---------------- WS ---------------- */

function getHost () {
    return location.href.includes("RELOAD_ON_SAVE")
    ? "localhost" : location.host
}

const socket = new WebSocketManager(
    (id) => `ws://${getHost()}/schedule/ws/${id}`,
    { debug: true }
);

socket.connect(urlParams.get("id"))

socket.on("open", () => {
    showToast({ title: "Connected", type: "info" });
    el.websocketIndicator.style.setProperty('--status-hue', "150")
    el.websocketIndicator.textContent = "Live"
});

socket.on("message", (event) => {

    const type = event.type?.split(".").pop();

    if (type === "Load") loadSchedule(event.schedule);
    if (type === "RowEdited") applyRowPatch(event);
    if (type === "ActiveRowChanged") handleActiveRowChanged(event);
});

socket.on("close", () => {
    showToast({
        title: "Disconnected",
        type: "error"
    });
    el.websocketIndicator.style.setProperty('--status-hue', "0")
    el.websocketIndicator.textContent = "Disconnected"
});

socket.on("reconnect", ({ attempt, delay }) => {
    console.log(`Reconnecting in ${delay}ms (attempt ${attempt})`);
});


function updateActiveRowUI(rowId, activatedAt) {
    console.log(`Attemtping to activate row: ${rowId} ${activatedAt}`)
    // Remove previous active class
    if (state.activeRowId !== null) {
        const prevEl = document.querySelector(
            `tr[data-row="${state.activeRowId}"]`
        );
        if (prevEl) prevEl.classList.remove("active");
    }

    // Add new active class
    const newEl = document.querySelector(
        `tr[data-row="${rowId}"]`
    );

    if (newEl) newEl.classList.add("active");

    // Update input safely
    const instance = state.inputInstances?.get(`${rowId}-activatedAt`);
    if (instance) {
        instance.value = activatedAt;
    }

    // Update state
    state.activeRowId = rowId;
}

function handleActiveRowChanged(event) {

    const { activatedAt, rowId } = event;
    if (!rowId) return;

    updateActiveRowUI(rowId, activatedAt)

    const rowIndex = state.schedule.rows.findIndex((row) => row.id === rowId)
    state.schedule.rows[rowIndex].activatedAt = activatedAt;
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

    const sortedRows = [...schedule.rows]
        .sort((a, b) => a.order - b.order);

    const newRows = new Map(sortedRows.map(r => [r.id, r]));

    newRows.forEach((row, id) => {
        const old = state.previousRows.get(id);
        if (!old || !rowsEqual(old, row)) {
            renderRow(row, row.order);
        }
    });

    state.previousRows.forEach((_, id) => {
        if (!newRows.has(id)) removeRow(id);
    });

    state.previousRows = newRows;

    /* Visualize activated Row */
    const activatedAt = schedule?.rows?.find((row) => row.id === schedule?.activeRowId)?.activatedAt
    const activeRowId = schedule.activeRowId
    if (activeRowId && activatedAt) {
        updateActiveRowUI(activeRowId, activatedAt)
    }
}

function rowsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function setActive(rowId) {
    socket.send({
        type: Events.ACTIVE_CHANGED,
        rowId,
        scheduleId: state.schedule.id
    });
}

function startProgramAtRow(rowId) {
    socket.send({
        type: Events.START_PROGRAM_AT_ROW,
        rowId,
        scheduleId: state.schedule.id
    });
}

/* ---------------- ROW RENDER ---------------- */


function buildColumns(schedule) {
    const topFields = [["title", "Text"], ["page", "Text"], ["duration", "Duration"], ["activatedAt", "Time"]];
    const cellKeys = new Map();

    schedule.columns.forEach(col => {
        cellKeys.set(cleanTxt(col.name), col.type)
    })

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
    socket.send({
        type: Events.CREATE_ROW,
        scheduleId: state.schedule.id,
        order: currentOrder + 1
    });
}

function deleteRow(rowId) {
    socket.send({
        type: Events.DELETE_ROW,
        rowId,
        scheduleId: state.schedule.id
    })
}

function rowIndex(id) {
    return state.schedule.rows.findIndex((row) => row.id === id)
}
function rowAtOrder(order) {
    if (!state?.schedule?.rows) { return null }
    return state.schedule.rows.find((row) => row.order === order)
}

function renderRow(row, order = undefined) {
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
                    { type: "separator" },
                    { label: "Start Program Here", action: () => startProgramAtRow(row.id) },
                    { label: "Set Active", action: () => setActive(row.id) },
                    //{ label: "Rename", action: renameFn },
                    { type: "separator" },
                    { label: "New Row Below", action: () => createRowBelow(row.order)},
                    { label: "Delete", action: () => deleteRow(row.id), danger: true}
                ]
            });
        })

        // Get element before its index (if exists) and use it as reference
        const prevOrder = row.order-1
        console.log(row.page + " prev: " + prevOrder)
        if (prevOrder > 0) {
            const adjacentRow = rowAtOrder(row.order-1)
            console.log(adjacentRow)
            const adjacentRowEl = document.querySelector(`tr[data-row="${adjacentRow.id}"]`);
            adjacentRowEl.insertAdjacentElement("afterend", tr)
        } else {
            el.body.appendChild(tr)
        }
    }

    tr.innerHTML = "";

    state.columns.forEach(([key, type]) => {
        const td = document.createElement("td");
        td.dataset.cell = key;

        /* -------- TOP FIELDS -------- */

        if (["title","page","script","duration","activatedAt"].includes(key)) {

            let inputInstance = null;

            switch (type.toLowerCase()) {
                case "time":
                    inputInstance = createTimeInput(row[key]);
                    state.inputInstances.set(`${row.id}-${key}`, inputInstance);
                    break;

                case "duration":
                    inputInstance = createDurationInput(row[key]);
                    state.inputInstances.set(`${row.id}-${key}`, inputInstance);
                    break;

                default:
                    inputInstance = createTextInput(row[key]);
                    break;
            }

            if (!nonInteractibleKeys.includes(key)) {

                inputInstance.element.addEventListener("change", () => {
                    socket.send({
                        type: Events.ROW_EDIT,
                        scheduleId: state.schedule.id,
                        rowId: row.id,
                        key,
                        value: inputInstance.value // ← ALWAYS correct now
                    });
                });
            }

            td.appendChild(inputInstance.element);
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

                socket.send({
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

function createTimeInput(value) {
    return new TimeInput(value);
}

function createDurationInput(value) {
    return new DurationInput(value);
}

function createTextInput(value) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    return {
        element: input,
        get value() { return input.value; },
        set value(v) { input.value = v; }
    };
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

let scheduleId = urlParams.get("id")


document.getElementById("select-schedule-load")
    .addEventListener("selected", e => {
        console.log("User picked:", e.detail);
        console.log("Attempting to disconnect from current Socket")

        const url = new URL(window.location.href);
        url.searchParams.set("id", e.detail.id);
        window.history.replaceState({}, "", url);

        socket.disconnect()
        socket.connect(e.detail.id)
    });

el.createRowBtn.addEventListener("click", e => {
    const rows = state?.schedule?.rows ?? [];

    if (rows.length === 0) {
        createRowBelow(0);
        return;
    }

    const highestOrder = Math.max(...rows.map(r => r.order));
    createRowBelow(highestOrder);
});
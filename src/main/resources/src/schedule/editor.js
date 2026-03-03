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
    START_PROGRAM_AT_ROW: "com.example.websocket.ScheduleEvent.StartProgramAtRow",
    CREATE_COLUMN: "com.example.websocket.ScheduleEvent.ColumnCreate",
    EDIT_COLUMN: "com.example.websocket.ScheduleEvent.ColumnEdited",
    DELETE_COLUMN: "com.example.websocket.ScheduleEvent.ColumnDelete"
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

    showToast({title: type, message: JSON.stringify(event) })

    if (type === "Load") loadSchedule(event.schedule);
    if (type === "RowEdited") applyRowPatch(event);
    if (type === "ActiveRowChanged") handleActiveRowChanged(event);
    if (type === "ColumnEdited") applyColumnPatch(event);
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
    state.columns = schedule.columns

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
    const topFields = [
        { key: "title", type: "Text", top: true },
        { key: "page", type: "Text", top: true },
        { key: "duration", type: "Duration", top: true },
        { key: "activatedAt", type: "Time", top: true }
    ];

    const dbColumns = schedule.columns
        .sort((a, b) => a.order - b.order)
        .map(col => ({
            columnId: col.id,
            name: col.name,
            type: col.type,
            top: false
        }));

    return [...topFields, ...dbColumns];
}

function columnsEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}


function createColumnAfter(currentOrder = null) {
    const columns = state.schedule?.columns ?? [];

    const highestOrder = columns.length > 0
        ? Math.max(...columns.map(c => c.order))
        : -1;

    const order = currentOrder !== null
        ? currentOrder + 1
        : highestOrder + 1;

    socket.send({
        type: Events.CREATE_COLUMN,
        scheduleId: state.schedule.id,
        order: order,
        name: "New Column",
        columnType: "Text"
    });
}

function renderHeader(columns) {
    if (!el.head) return;

    el.head.innerHTML = "";

    const tr = document.createElement("tr");

    function deleteColumn(id) {
        socket.send({
            type: Events.DELETE_COLUMN,
            scheduleId: state.schedule.id,
            columnId: id,
        });
    }

    state.columns.forEach(col => {
        const th = document.createElement("th");

        if (col.top) {
            th.innerHTML = `<span>${col.key.toUpperCase()} <span class="type-name-label">${col.type}</span></span>`;
            th.dataset.column = col.key
        } else {
            th.dataset.column = col.columnId
            const wrapper = document.createElement("div");
            wrapper.className = "column-header-editable";

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = col.name;
            nameInput.className = "column-name-input";

            const typeSelect = document.createElement("select");
            ["Text", "Number", "Boolean", "Time"].forEach(t => {
                const opt = document.createElement("option");
                opt.classList = "type-option"
                opt.value = t;
                opt.textContent = t;
                if (t === col.type) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.classList = "type-select"

            wrapper.appendChild(nameInput);
            //wrapper.appendChild(typeSelect);
            th.appendChild(wrapper);

            function sendEdit() {
                socket.send({
                    type: Events.EDIT_COLUMN,
                    scheduleId: state.schedule.id,
                    columnId: col.columnId,
                    name: nameInput.value,
                    columnType: typeSelect.value
                });
            }

            nameInput.addEventListener("change", sendEdit);
            typeSelect.addEventListener("change", sendEdit);
        }
        th.addEventListener("contextmenu", e => {
            if (e.ctrlKey || e.altKey || e.metaKey) return

            if (col.columnId === undefined) { return}
            e.preventDefault();

            showContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                    { label: "Create After", action: () => createColumnAfter(col.order) },
                    { type: "separator" },
                    { label: "Delete Column", action: () => deleteColumn(col.columnId), danger: true },
                ]
            });
        });
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
        const existingRows = Array.from(el.body.querySelectorAll("tr[data-row]"));

        let inserted = false;
        for (const existing of existingRows) {
            const existingId = Number(existing.dataset.row);
            const existingRow = state.previousRows.get(existingId) || state.schedule?.rows?.find(r => r.id === existingId);
            const existingOrder = existingRow?.order ?? Number.POSITIVE_INFINITY;

            if (existingOrder > row.order) {
                el.body.insertBefore(tr, existing);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            el.body.appendChild(tr);
        }
    }

    tr.innerHTML = "";

    state.columns.forEach(col => {
        const td = document.createElement("td");

        /* -------- TOP FIELDS -------- */

        if (col.top) {
            const key = col.key;
            const type = col.type;

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
            const cell = row.cells?.[col.columnId];

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
                    columnId: col.columnId,
                    cell: {
                        type: cell?.type ?? col.type,
                        value: value,
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

function applyColumnPatch(event) {
    const { columnId, name, columnType } = event;

    if (!state.schedule?.columns) return;

    const column = state.schedule.columns.find(c => c.id === columnId);
    if (!column) return;

    column.name = name;
    column.columnType = columnType;

    // Update state.columns (used for rendering)
    const uiColumn = state.columns.find(c => c.columnId === columnId);
    if (uiColumn) {
        uiColumn.name = name;
        uiColumn.columnType = columnType;
    }

    renderHeader(state.columns);

    showToast({
        title: "Column Updated",
        type: "info"
    });
}

function applyRowPatch(event) {
    const { rowId, key, value, cell, columnId } = event;
    if (!rowId) return;

    const row = state.previousRows.get(rowId);
    if (!row) return;

    // TOP LEVEL PATCH
    if (cell == null) {
        if (key) row[key] = value;
    }
    // CELL PATCH
    else {
        if (!row.cells) row.cells = {};
        row.cells[columnId] = cell;
    }

    state.previousRows.set(rowId, row);
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
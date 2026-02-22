import {WebSocketManager} from "./socket-manager.js";
import {showToast} from "./components/toast.js";

/* ---------------- PARAMS ---------------- */

const urlParams = new URLSearchParams(location.search);
const scheduleId = Number(urlParams.get("id") || 1);

/* ---------------- EVENTS ---------------- */

const Events = {
    REQUEST_LOAD: "com.example.websocket.ScheduleEvent.RequestLoad",
    ROW_EDIT: "com.example.websocket.ScheduleEvent.RowEdited",
    CREATE_ROW: "com.example.websocket.ScheduleEvent.RowCreate",
    DELETE_ROW: "com.example.websocket.ScheduleEvent.RowDelete",
    ACTIVE_CHANGED: "com.example.websocket.ScheduleEvent.ActiveRowChanged",
    START_PROGRAM_AT_ROW: "com.example.websocket.ScheduleEvent.StartProgramAtRow"
};

/* ---------------- STATE ---------------- */

const state = {
    ws: null,
    reconnectTimer: null,
    rows: new Map(),
    saveTimers: new Map()
};

const container = document.getElementById("container");

/* ---------------- WS ---------------- */



function getHost() {
    if (location.toString().includes("RELOAD_ON_SAVE")) return "localhost";
    return location.host;
}

const socket = new WebSocketManager(
    (id) => `ws://${getHost()}/schedule/ws/${id}`,
    { debug: true }
);

socket.connect(urlParams.get("id"))

socket.on("open", () => {
    showToast({ title: "Connected", type: "info" });
});

socket.on("message", (event) => {

    const type = event.type?.split(".").pop();

    if (type === "Load") handleLoad(event.schedule);
    if (type === "RowEdited") applyRowPatch(event);
    if (type === "RowCreate") handleRowCreate(event.row);
    if (type === "RowDelete") handleRowDelete(event);
});

socket.on("close", () => {
    showToast({
        title: "Disconnected",
        type: "error"
    });
});

socket.on("reconnect", ({ attempt, delay }) => {
    console.log(`Reconnecting in ${delay}ms (attempt ${attempt})`);
});

/* ---------------- WS HANDLERS ---------------- */

function handleLoad(schedule) {
    state.rows.clear();
    container.innerHTML = "";

    (schedule.rows || []).forEach(row => {
        state.rows.set(row.id, row);
        renderRow(row);
    });

    scrollToRow();
}

function scrollToRow() {
    const rowId = urlParams.get("row");
    console.log(rowId)
    if (!rowId) return;

    const el = document.querySelector(`div[data-row-id="${rowId}"]`);
    if (!el) return;

    // small delay so layout finishes
    setTimeout(() => {
        el.scrollIntoView({
            behavior: "instant",
            block: "start"
        });
    }, 50);
}

function handleRowCreate(row) {
    state.rows.set(row.id, row);
    renderRow(row);
}

function handleRowDelete(rowId) {
    state.rows.delete(rowId);
    const el = container.querySelector(`[data-row-id="${rowId}"]`);
    if (el) el.remove();
}

function applyRowPatch(event) {
    console.log("Incoming Row Edit Listened", event)
    const { rowId, key, value, cell } = event;
    const row = state.rows.get(rowId);
    if (!row) return;

    if (!cell) row[key] = value;
    else {
        row.cells ??= {};
        row.cells[key] = cell;
    }

    state.rows.set(rowId, row);
    updateRowTextarea(rowId);
}

/* ---------------- RENDER ---------------- */

function renderRow(row) {
    const wrapper = document.createElement("div");
    wrapper.className = "row";
    wrapper.dataset.rowId = row.id;
    wrapper.id = `row-${row.id}`; // <-- anchor id

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = `${row.page || ""} - ${row.title || ""}`;

    const textarea = document.createElement("textarea");
    textarea.value = getScript(row);

    const status = document.createElement("div");
    status.className = "save-status";
    status.textContent = "Idle";

    const btn = document.createElement("button");
    btn.textContent = "Save";

    function save() {
        status.textContent = "Saving...";
        socket.send({
            type: Events.ROW_EDIT,
            scheduleId,
            rowId: row.id,
            key: "script",
            value: textarea.value
        });
        status.textContent = "Saved";
    }

    // --------- DEBOUNCED AUTOSAVE ---------
    function scheduleAutoSave() {
        status.textContent = "Typing...";

        if (state.saveTimers.has(row.id)) {
            clearTimeout(state.saveTimers.get(row.id));
        }

        const t = setTimeout(() => {
            save();
            state.saveTimers.delete(row.id);
        }, 1000);

        state.saveTimers.set(row.id, t);
    }

    textarea.addEventListener("input", scheduleAutoSave);

    // Ctrl+Enter instant save
    textarea.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            save();
        }
    });

    btn.onclick = save;

    wrapper.appendChild(title);
    wrapper.appendChild(textarea);
    wrapper.appendChild(btn);
    wrapper.appendChild(status);

    container.appendChild(wrapper);
}


function updateRowTextarea(rowId) {
    const row = state.rows.get(rowId);
    const rowEl = container.querySelector(`[data-row-id="${rowId}"]`);
    console.log(rowEl)
    if (!rowEl) return;

    const textArea = rowEl.querySelector("textarea")
    textArea.value = getScript(row);

    const title = rowEl.querySelector(".title")
    title.textContent = `${row.page} - ${row.title}`
}

/* ---------------- HELPERS ---------------- */

function getScript(row) {
    return row.script ?? row.cells?.script?.value ?? "";
}

function safeJson(str) {
    try { return JSON.parse(str); }
    catch { return null; }
}

/* ---------------- BOOT ---------------- */

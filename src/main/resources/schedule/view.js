const ws = new WebSocket("ws://" + location.host + "/schedule/ws");

let schedule = null;
let activeColumnId = null;

/* -------------------- WS -------------------- */

ws.onopen = (e) => {
    console.log(e);
};

ws.onmessage = e => {
    const event = JSON.parse(e.data);

    switch (event.type.split(".").pop()) {
        case "Load":
            console.log("Attempting to load schedule");
            schedule = event.schedule;
            activeColumnId = schedule?.activeColumnId ?? null;
            render();
            break;

        case "ActiveColumnChanged":
            activeColumnId = event.columnId;
            render();
            break;

        case "ColumnEdited":
            applyEdit(event);
            render();
            break;
    }
};

/* -------------------- TIMING -------------------- */

// Re-render clock every second
setInterval(() => {
    if (schedule) render();
}, 1000);

// Duration is stored in cells["duration"].value in SECONDS
function getDurationMs(col) {
    return Number(col.duration ?? 0);
}


// Sum all durations ABOVE this column
function getCumulativeOffsetMs(targetCol) {
    if (!schedule) return 0;

    let sum = 0;
    for (const col of schedule.columns) {
        if (col.id === targetCol.id) break;
        sum += getDurationMs(col);
    }
    return sum;
}

// Absolute start = programStart + cumulative offset
function getColumnAbsoluteStart(col) {
    if (!schedule?.programStart) return null;

    const offset = getCumulativeOffsetMs(col);
    return schedule.programStart + offset;
}

function getColumnTiming(col) {
    const abs = getColumnAbsoluteStart(col);
    if (!abs) return { status: "UNKNOWN", diff: 0, abs: null };

    const now = Date.now();
    const diff = abs - now;

    const tolerance = 5000; // 5 sec window

    let status = "UPCOMING";
    if (Math.abs(diff) <= tolerance) status = "ON TIME";
    else if (diff < -tolerance) status = "LATE";

    return { status, diff, abs };
}

function formatMs(ms) {
    const total = Math.floor(Math.abs(ms) / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatClock(ms) {
    return new Date(ms).toLocaleTimeString();
}

/* -------------------- EDITS -------------------- */

function applyEdit(event) {
    const col = schedule.columns.find(c => c.id === event.columnId);
    if (!col) return;
    col.cells[event.key] = event.value;
}

/* -------------------- INPUT -------------------- */

document.addEventListener("keydown", e => {
    if (!schedule) return;

    const idx = schedule.columns.findIndex(c => c.id === activeColumnId);
    if (idx === -1) return;

    if (e.key === "ArrowDown" || e.key === " ") {
        setActiveIndex(idx + 1);
    }

    if (e.key === "ArrowUp") {
        setActiveIndex(idx - 1);
    }
});

function setActiveIndex(newIndex) {
    if (!schedule) return;
    if (newIndex < 0 || newIndex >= schedule.columns.length) return;

    setActive(schedule.columns[newIndex].id);
}

function setActive(columnId) {
    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.ActiveColumnChanged",
        columnId
    }));
}

/* -------------------- RENDER -------------------- */

function render() {
    const table = document.getElementById("scheduleTable");
    table.innerHTML = "";

    if (!schedule) return;

    // Active label
    const activeLabel = document.getElementById("active-column");
    const activeItem = schedule.columns.find(c => c.id === activeColumnId);
    activeLabel.textContent = activeItem
        ? `${activeItem.id} - ${activeItem.title}`
        : "None";

    // Program start label (optional)
    const startLabel = document.getElementById("program-start");
    if (startLabel && schedule.programStart) {
        startLabel.textContent =
            "Program Start: " + formatClock(schedule.programStart);
    }

    // Columns/fields
    const keys = new Set(["id", "title", "start", "countdown", "status"]);
    schedule.columns.forEach(col =>
        Object.keys(col.cells || {}).forEach(k => keys.add(k))
    );

    // Header
    const headerRow = document.createElement("tr");
    keys.forEach(key => {
        const th = document.createElement("th");
        th.textContent = key.toUpperCase();
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Rows
    schedule.columns.forEach(col => {
        const row = document.createElement("tr");

        if (col.id === activeColumnId) {
            row.classList.add("active");
        }

        row.addEventListener("click", () => setActive(col.id));

        keys.forEach(key => {
            const td = document.createElement("td");

            if (key === "id") {
                td.textContent = col.id;

            } else if (key === "title") {
                td.textContent = col.title;

            } else if (key === "start") {
                const t = getColumnTiming(col);
                td.textContent = t.abs ? formatClock(t.abs) : "-";

            } else if (key === "countdown") {
                const t = getColumnTiming(col);

                if (!t.abs) {
                    td.textContent = "-";
                } else if (t.diff > 0) {
                    td.textContent = "In " + formatMs(t.diff);
                } else {
                    td.textContent = formatMs(t.diff) + " ago";
                }

            } else if (key === "status") {
                const t = getColumnTiming(col);
                td.textContent = t.status;

                td.classList.remove("upcoming", "ontime", "late");
                if (t.status === "UPCOMING") td.classList.add("upcoming");
                if (t.status === "ON TIME") td.classList.add("ontime");
                if (t.status === "LATE") td.classList.add("late");

            } else {
                td.textContent = formatCell(col.cells?.[key]);
            }

            row.appendChild(td);
        });

        table.appendChild(row);
    });
}

/* -------------------- UTIL -------------------- */

function formatCell(val) {
    if (!val) return "";
    if (val.value !== undefined) return val.value;
    return JSON.stringify(val);
}

/* -------------------- HORIZONTAL NAV -------------------- */

document.addEventListener("keydown", e => {
    if (!schedule) return;

    const idx = schedule.columns.findIndex(c => c.id === activeColumnId);
    if (idx === -1) return;

    if (e.key === "ArrowRight") move(idx + 1);
    if (e.key === "ArrowLeft") move(idx - 1);
});

function move(newIndex) {
    if (!schedule) return;
    if (newIndex < 0 || newIndex >= schedule.columns.length) return;

    ws.send(JSON.stringify({
        type: "ActiveColumnChanged",
        columnId: schedule.columns[newIndex].id
    }));
}

import {
    formatCell,
    cleanTxt,
    formatMillisTime,
    parseTimeToTodayMillis,
    formatClock,
    getColumnTiming,
    getColumnAbsoluteStart,
    getDurationMs,
    getCumulativeOffsetMs, millisSince, startTicker
} from "./utils.js?v=1";

let host = location.host;
if (location.toString().includes("RELOAD_ON_SAVE")) {
    host = "localhost"
}
const ws = new WebSocket("ws://" + host + "/schedule/ws");

let schedule = null;
let activeColumnId = null;

/* -------------------- WS -------------------- */

ws.onopen = (e) => {
    console.log(e);
};

ws.onmessage = e => {
    const event = JSON.parse(e.data);

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
            activeColumnId = schedule?.activeColumnId ?? null;
            console.log(schedule)
            render();
            break;

        case "ActiveColumnChanged":
            activeColumnId = event.columnId;

            if (schedule?.columns) {
              const col = schedule.columns.find(c => c.id === event.columnId);
              if (col) {
                 col.activatedAt = event.activatedAt;
               }
            }

            render();
            break;

        case "ColumnEdited":
            applyEdit(event);
            render();
            break;
    }
};


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
        programStart: ms
    }));
}

const rundownReload = document.getElementById("rundown-reload");

rundownReload?.addEventListener("click", () => {
    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.ReloadSchedule",
    }));
})


/* -------------------- TIMING -------------------- */

// Duration is stored in cells["duration"].value in SECONDS

// Sum all durations ABOVE this column

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
        e.preventDefault()
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

    const activeLabel = document.getElementById("active-column");
    const activeItem = schedule.columns.find(c => c.id === activeColumnId);

    if (!activeItem) {
        activeLabel.textContent = "No column selected";
    } else {
        const t = getColumnTiming(activeItem, schedule);
        activeLabel.textContent =
            `${activeItem.id} - ${cleanTxt(activeItem.title)} - ${formatMillisTime(t.remaining)}`;
    }

    // Program start label (optional)
    const startLabel = document.getElementById("program-start");
    if (startLabel && schedule.programStart) {
        startLabel.textContent =
            "Program Start: " + formatClock(schedule.programStart);
    }

    const keys = new Set(["id", "title", "status", "duration", "delay"]);

    schedule.columns.forEach(col =>
        Object.keys(col.cells || {}).forEach(raw => {
            keys.add(cleanTxt(raw))
        })
    );

    console.log(schedule.columns?.[0])
    console.log({keys})

    // Header
    const headerRow = document.createElement("tr");
    keys.forEach(key => {
        const th = document.createElement("th");
        th.textContent = key.toUpperCase();
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Placeholder row if no active column
    if (!activeItem) {
        const row = document.createElement("tr");
        row.classList.add("placeholder-row");

        keys.forEach((key, i) => {
            const td = document.createElement("td");

            if (i === 0) {
                td.textContent = "-";
            } else if (key === "title") {
                td.textContent = "No column selected – waiting for input from script";
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
                td.textContent = cleanTxt(col.title);

            } else if (key === "start") {
                const t = getColumnTiming(col, schedule);
                td.textContent = t.abs ? formatClock(t.abs) : "-";

            } else if (key === "status") {
                const t = getColumnTiming(col, schedule);
                td.textContent = t.status;

                td.classList.remove("upcoming", "ontime", "late", "overdue");
                if (t.status === "UPCOMING") td.classList.add("upcoming");
                if (t.status === "ON TIME") td.classList.add("ontime");
                if (t.status === "LATE") td.classList.add("late");
                if (t.status === "OVERDUE") td.classList.add("late");

            } else if (key === "duration") {
                const t = getColumnTiming(col, schedule)
                const activeIndex = schedule.columns.findIndex(c => c.id === activeColumnId);
                const idx = schedule.columns.findIndex(c => c.id === col.id);
                if (activeColumnId !== col.id) {
                    td.textContent = formatMillisTime(t.duration)
                } else if (t.remaining > 0) {
                    td.textContent = formatMillisTime(t.remaining)
                }
            } else if (key === "delay") {
                  const t = getColumnTiming(col, schedule);

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
                td.textContent = formatCell(col.cells?.[key]);
            }

            row.appendChild(td);
        });

        table.appendChild(row);
    });
}

// Re-render clock every second
startTicker(1000, () => render())


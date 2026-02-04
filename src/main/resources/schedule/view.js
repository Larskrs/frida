const ws = new WebSocket("ws://" + location.host + "/schedule/ws");

let schedule = null;
let activeColumnId = null;

ws.onopen = (e) => {
    console.log(e)
}

ws.onmessage = e => {
    const event = JSON.parse(e.data);

    switch (event.type.split(".").pop()) {
        case "Load":
            console.log("Attempting to load schedule")
            schedule = event.schedule;
            activeColumnId = schedule?.activeColumnId ?? "unknown";
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

function applyEdit(event) {
    const col = schedule.columns.find(c => c.id === event.columnId);
    if (!col) return;
    col.cells[event.key] = event.value;
}

document.addEventListener("keydown", e => {
    if (!schedule) return

    const idx = schedule.columns.findIndex(c => c.id === activeColumnId);
    if (idx === -1) return


    if (e.key === "ArrowDown") setActive(schedule.columns?.[idx + 1].id)
    if (e.key === "ArrowUp") setActive(schedule.columns?.[idx - 1].id)
})
function setActiveIndex(newIndex) {
    if (newIndex < 0 || newIndex >= schedule.columns.length) return;
    const columnId = schedule.columns[newIndex].id;

    setActive(columnId)
}
function setActive(columnId) {
    console.log("Attempting to update active column")
    ws.send(JSON.stringify({
        type: "com.example.websocket.ScheduleEvent.ActiveColumnChanged",
        columnId: columnId
    }));
}

function render() {
    const table = document.getElementById("scheduleTable");
    table.innerHTML = "";

    if (!schedule) return;

    // Update top label
    const activeLabel = document.getElementById("active-column");
    const activeItem = schedule.columns.find(c => c.id === activeColumnId);
    activeLabel.textContent = activeItem
        ? `${activeItem.id} - ${activeItem.title}`
        : "None";

    // Collect all keys (fields)
    const keys = new Set(["id", "title"]);
    schedule.columns.forEach(col =>
        Object.keys(col.cells).forEach(k => keys.add(k))
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

        row.addEventListener("click", () => {
            setActive(col.id);
        });

        keys.forEach(key => {
            const td = document.createElement("td");

            if (key === "id") td.textContent = col.id;
            else if (key === "title") td.textContent = col.title;
            else td.textContent = formatCell(col.cells[key]);

            row.appendChild(td);
        });

        table.appendChild(row);
    });
}

function formatCell(val) {
    if (!val) return "";
    if (val.value !== undefined) return val.value;
    return JSON.stringify(val);
}

document.addEventListener("keydown", e => {
    if (!schedule) return;

    const idx = schedule.columns.findIndex(c => c.id === activeColumnId);
    if (idx === -1) return;

    if (e.key === "ArrowRight") move(idx + 1);
    if (e.key === "ArrowLeft") move(idx - 1);
});

function move(newIndex) {
    if (newIndex < 0 || newIndex >= schedule.columns.length) return;

    const columnId = schedule.columns[newIndex].id;

    ws.send(JSON.stringify({
        type: "ActiveColumnChanged",
        columnId
    }));
}

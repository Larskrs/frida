/* -------------------- UTIL -------------------- */

export function formatMillisTime (ms) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

export function cleanTxt(txt) {
    return txt.replace(/[^\p{L}\p{N} /]/gu, "");
}

export function formatCell(val) {
    if (!val) return "";
    if (val.type === "Time") {
      const ms = val.millis;
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / 60000) % 60;
      const h = Math.floor(ms / 3600000);
      return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
    }
    if (val.value !== undefined) return cleanTxt(val.value);
    return JSON.stringify(val.value);
}

export function startTicker(delay, callback) {
  let lastSecond = Math.floor(Date.now() / delay);

  function loop() {
    const currentSecond = Math.floor(Date.now() / delay);

    if (currentSecond !== lastSecond) {
      lastSecond = currentSecond;
      callback();
    }

    requestAnimationFrame(loop);
  }

  loop();
}

export function getElapsedMs(row) {
  if (!row.activatedAt) return 0;
  return Date.now() - row.activatedAt;
}

export function getRemainingMs(row) {
  if (!row.activatedAt) return null;

  const elapsed = getElapsedMs(row);
  const duration = getDurationMs(row)
  if (!elapsed || !duration) {
    return 0
  }
  return duration - elapsed;
}

export function parseTimeToTodayMillis(timeStr) {
    // "21:34:10"
    const [h, m, s] = timeStr.split(":").map(Number);

    const d = new Date();
    d.setHours(h ?? 0);
    d.setMinutes(m ?? 0);
    d.setSeconds(s ?? 0);
    d.setMilliseconds(0);

    return d.getTime();
}

export function formatMs(ms) {
    const total = Math.floor(Math.abs(ms) / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function millisSince(at, from) {
    return at-from
}

export function formatClock(ms) {
    const date = new Date(ms);

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}
export function formatTimeOfDayClock(ms) {
    const date = new Date(ms);

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}


const imageMap = {
    k1: "/img/k1.png",
    k2: "/img/k2.png",
    k3: "/img/k3.png",
    k4: "/img/k4.png",
    k5: "/img/k5.png",
    liveu: "/img/liveu.png",
    evs: "/img/evs.png"
};

export function getIpImage(input) {
    if (!input) return [];

    return input
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
        .map(key => imageMap[key] || "/img/default.png");
}

function createFallbackBox(label) {
    const box = document.createElement("div");
    box.className = "ip-box ip-fallback";

    const p = document.createElement("p");
    p.textContent = label || "—";

    box.appendChild(p);
    return box;
}

function safeImg(src, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;

    img.onerror = () => {
        const fallback = createFallbackBox(alt);
        img.replaceWith(fallback);
    };

    return img;
}


export function createIpBox(txtRaw) {
    let txt = (txtRaw || "").trim();
    const clean = cleanTxt(txt);

    if (!clean) return createFallbackBox("—");

    const upper = txt.toUpperCase().replace(/"/g, "");
    const box = document.createElement("div");
    box.className = "ip-box";

    // -------- SPLIT DETECTION --------
    const splitMatch = upper.split(/[\/\s]+/).filter(Boolean);

    // Case 1: Explicit SPLIT
    if (upper === "SPLIT") {
        box.appendChild(safeImg("./img/SPLIT.png", "SPLIT"));
        return box;
    }

    // Case 2: Split Mode
    if (splitMatch.length === 2) {
        const [left, right] = splitMatch;
        box.classList.add("split");

        const leftImg = safeImg(`./img/SPLIT_L_${left}.png`, left);
        leftImg.className = "split-left";

        const rightImg = safeImg(`./img/SPLIT_R_${right}.png`, right);
        rightImg.className = "split-right";

        box.appendChild(leftImg);
        box.appendChild(rightImg);
        return box;
    }

    // -------- NORMAL MODE --------
    box.appendChild(safeImg(`./img/${upper}.png`, upper));
    return box;
}


export function getCumulativeOffsetMs(targetrow, schedule) {
    if (!schedule) return 0;
    if (!targetrow) return 0

    let sum = 0;
    for (const row of schedule.rows) {
        if (row.id === targetrow.id) break;
        sum += getDurationMs(row);
    }
    return sum;
}

export function getRowAbsoluteStart(row, schedule) {
    if (!schedule?.programStart) return null;

    const offset = getCumulativeOffsetMs(row, schedule);
    return schedule.programStart + offset;
}

export function getDurationMs(row) {
    return Number(row?.duration ?? 0);
}

export function getRowTiming(row, schedule) {

    if (!schedule) return 0
    if (!row) return 0

    const abs = getRowAbsoluteStart(row, schedule);
    const duration = getDurationMs(row);

    if (!abs) return { status: "UNKNOWN", delay: 0, abs: null };

    const tolerence = 3000;

    const now = Date.now();
    const activatedAt = row.activatedAt ?? null;

    const elapsed = activatedAt ? now - activatedAt : 0;
    const remaining = activatedAt ? duration - elapsed : duration;

    // ---- DELAY ----
    let delay = 0;
    if (activatedAt) {
      delay = activatedAt - abs;
    } else {
      // not started yet → how far past planned start we are
      delay = now - abs;
    }

    let status = "UPCOMING";

    if (activatedAt) {
      if (delay < -tolerence) status = "EARLY";
      else if (Math.abs(delay) <= tolerence) status = "ON TIME";
      else status = "LATE";
    } else {
      if (now > abs + duration) status = "MISSED";
      else if (now > abs) status = "OVERDUE";
    }

    return {
      status,
      abs,
      remaining,
      duration,
      delay
    };
}

export function getScheduleTiming(schedule) {
    if (!schedule?.rows?.length) {
        return {
            programFinish: 0,
            status: "finished",
            delay: 0,
            remaining: 0
        };
    }

    const now = Date.now();

    // ---- LOCAL NORMALIZATION ----
    let programStart = schedule.programStart ?? now;

    // If programStart is a string or HH:mm:ss style, force local
    if (typeof programStart === "string") {
        const d = new Date();
        const [h, m, s = 0] = programStart.split(":").map(Number);
        d.setHours(h, m, s, 0);
        programStart = d.getTime();
    }

    // Total duration
    const totalDuration = schedule.rows.reduce((acc, row) => {
        const dur = getDurationMs(row);
        return acc + (dur || 0);
    }, 0);

    const programFinish = programStart + totalDuration;
    const remaining = programFinish - now;

    let status = "ontime";
    let delay = 0;

    if (remaining <= 0) {
        status = "finished";
        delay = Math.abs(remaining);
    } else {
        const elapsedSinceStart = now - programStart;
        const expectedProgress = Math.min(elapsedSinceStart, totalDuration);

        let actualProgress = 0;
        const activeIndex = schedule.rows.findIndex(
            r => r.id === schedule.activeRowId
        );

        if (activeIndex >= 0) {
            for (let i = 0; i < activeIndex; i++) {
                actualProgress += getDurationMs(schedule.rows[i]) || 0;
            }

            const activeRow = schedule.rows[activeIndex];
            if (activeRow?.activatedAt) {
                actualProgress += now - activeRow.activatedAt;
            }
        }

        delay = actualProgress - expectedProgress;

        if (delay > 1000) status = "late";
        else if (delay < -1000) status = "early";
        else status = "ontime";
    }

    return {
        programFinish,
        status,
        delay,
        remaining: Math.max(0, remaining)
    };
}

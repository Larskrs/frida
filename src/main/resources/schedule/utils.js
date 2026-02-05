/* -------------------- UTIL -------------------- */

export function formatMillisTime (ms) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

export function cleanTxt(txt) {
  return txt.replace(/[^a-z0-9 ]/gi, "");
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

export function getElapsedMs(col) {
  if (!col.activatedAt) return 0;
  return Date.now() - col.activatedAt;
}

export function getRemainingMs(col) {
  if (!col.activatedAt) return null;

  const elapsed = getElapsedMs(col);
  const duration = getDurationMs(col)
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

    // Get time components
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    // Milliseconds should be padded to 3 digits
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    // Format the time string
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function getCumulativeOffsetMs(targetCol, schedule) {
    if (!schedule) return 0;

    let sum = 0;
    for (const col of schedule.columns) {
        if (col.id === targetCol.id) break;
        sum += getDurationMs(col);
    }
    return sum;
}

export function getColumnAbsoluteStart(col, schedule) {
    if (!schedule?.programStart) return null;

    const offset = getCumulativeOffsetMs(col, schedule);
    return schedule.programStart + offset;
}

export function getDurationMs(col) {
    return Number(col.duration ?? 0);
}

export function getColumnTiming(col, schedule) {

    const abs = getColumnAbsoluteStart(col, schedule);
    const duration = getDurationMs(col);

    if (!abs) return { status: "UNKNOWN", delay: 0, abs: null };

    const tolerence = 3000;

    const now = Date.now();
    const activatedAt = col.activatedAt ?? null;

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
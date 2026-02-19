/* ========================================================= */
/* =================== BASE CLASS ========================== */
/* ========================================================= */

class BaseTimeInput {

    constructor() {
        this.el = document.createElement("input");
        this.el.type = "text";
        this.el.inputMode = "numeric";
        this.el.placeholder = "hh:NN:ss";
        this.el.autocomplete = "off";
    }

    pad(n) {
        return String(n).padStart(2, "0");
    }

    normalize(value) {
        const digits = String(value ?? "")
            .replace(/\D/g, "")
            .padEnd(6, "0")
            .slice(0, 6);

        const hh = Math.min(23, parseInt(digits.slice(0, 2)) || 0);
        const nn = Math.min(59, parseInt(digits.slice(2, 4)) || 0);
        const ss = Math.min(59, parseInt(digits.slice(4, 6)) || 0);

        return `${this.pad(hh)}:${this.pad(nn)}:${this.pad(ss)}`;
    }

    get element() {
        return this.el;
    }
}

/* ========================================================= */
/* =================== DURATION INPUT ====================== */
/* ========================================================= */

export class DurationInput extends BaseTimeInput {

    constructor(initialMillis = 0) {
        super();
        this.el.value = this.millisToTime(initialMillis);

        this.el.addEventListener("blur", () => {
            this.el.value = this.normalize(this.el.value);
            this.el.dispatchEvent(new Event("change"));
        });
    }

    millisToTime(ms) {
        const totalSeconds = Math.floor((ms ?? 0) / 1000);

        const hh = Math.floor(totalSeconds / 3600);
        const nn = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;

        return `${this.pad(hh)}:${this.pad(nn)}:${this.pad(ss)}`;
    }

    timeToMillis() {
        const [hh, nn, ss] = this.normalize(this.el.value).split(":").map(Number);
        return ((hh * 60 + nn) * 60 + ss) * 1000;
    }

    get millis() {
        return this.timeToMillis();
    }

    set millis(ms) {
        this.el.value = this.millisToTime(ms);
        this.el.dispatchEvent(new Event("change"));
    }

    get value() {
        return this.millis;
    }

    set value(ms) {
        this.millis = ms;
    }
}

/* ========================================================= */
/* =================== TIME OF DAY INPUT =================== */
/* ========================================================= */

export class TimeInput extends BaseTimeInput {

    constructor(initialTimestamp = null) {
        super();

        this._timestamp =
            typeof initialTimestamp === "number"
                ? initialTimestamp
                : null;

        // Only set value if we actually have a timestamp
        if (this._timestamp !== null) {
            this.el.value = this.timestampToTime(this._timestamp);
        } else {
            this.el.value = ""; // show placeholder
        }

        this.attachEvents();
    }

    attachEvents() {
        this.el.addEventListener("blur", () => {

            // If empty → reset to null
            if (!this.el.value.trim()) {
                this._timestamp = null;
                this.el.value = "";
                this.el.dispatchEvent(new Event("change"));
                return;
            }

            this._timestamp = this.timeToTimestamp(this.el.value);
            this.el.value = this.timestampToTime(this._timestamp);

            this.el.dispatchEvent(new Event("change"));
        });

        this.el.addEventListener("change", () => {
            if (!this.el.value.trim()) {
                this._timestamp = null;
            } else {
                this._timestamp = this.timeToTimestamp(this.el.value);
            }
        });
    }

    /* ================= Conversions ================= */

    timestampToTime(ms) {
        if (ms === null) return "";
        const d = new Date(ms);
        return `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
    }

    timeToTimestamp(timeStr) {
        if (!this._timestamp) {
            // Use today if no base date exists
            this._timestamp = Date.now();
        }

        const digits = String(timeStr ?? "")
            .replace(/\D/g, "")
            .padEnd(6, "0")
            .slice(0, 6);

        const hh = Math.min(23, parseInt(digits.slice(0, 2)) || 0);
        const nn = Math.min(59, parseInt(digits.slice(2, 4)) || 0);
        const ss = Math.min(59, parseInt(digits.slice(4, 6)) || 0);

        const base = new Date(this._timestamp);
        base.setHours(hh);
        base.setMinutes(nn);
        base.setSeconds(ss);
        base.setMilliseconds(0);

        return base.getTime();
    }

    /* ================= API ================= */

    get timestamp() {
        return this._timestamp;
    }

    set timestamp(ms) {
        if (typeof ms !== "number") {
            this._timestamp = null;
            this.el.value = "";
            return;
        }

        this._timestamp = ms;
        this.el.value = this.timestampToTime(ms);
        this.el.dispatchEvent(new Event("change"));
    }

    get value() {
        return this._timestamp;
    }

    set value(ms) {
        this.timestamp = ms;
    }

    set onchange(fn) {
        this.el.onchange = fn;
    }

    get onchange() {
        return this.el.onchange;
    }
}

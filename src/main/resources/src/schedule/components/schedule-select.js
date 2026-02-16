class ScheduleSelect extends HTMLElement {
    constructor() {
        super();
        this.schedules = [];
        this.loaded = false;

        this.loadSchedules().then(r => console.log("Loaded schedules"))
    }

    connectedCallback() {
        this.innerHTML = `
      <style>
        rundown-select select {
          padding: 8px 10px;
          font-size: 14px;
          font-family: "Roboto", sans-serif;
          background: #0c0c0c;
          border: 1px solid #2a2a2a;
          color: #e6e9ef;
          outline: none;
          border-radius: 0;
          width: 100%;
          appearance: none;
          cursor: pointer;
        }

        rundown-select select:hover {
          background: #151515;
        }

        rundown-select select:focus {
          border-color: #4c6fff;
        }

        /* Arrow */
        rundown-select {
          position: relative;
          display: inline-block;
          width: 220px;
        }

        rundown-select::after {
          content: "▾";
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #8b93a1;
          font-size: 12px;
        }

        /* Option styling (limited support) */
        rundown-select option {
          background: #111111;
          color: #e6e9ef;
        }
      </style>

      <select>
        <option disabled selected>Loading rundowns…</option>
      </select>
    `;

        this.select = this.querySelector("select");

        this.select.addEventListener("focus", () => this.loadSchedules(), { once: true });
        this.select.addEventListener("click", () => this.loadSchedules(), { once: true });
        this.select.addEventListener("change", () => this.handleChange());
    }

    getApiBase() {
        const url = new URL(window.location.href);

        // Example: dev override
        if (url.searchParams.has("_ijt")) {
            return "http://localhost";
        }

        return url.origin; // safest default
    }


    async loadSchedules() {
        if (this.loaded) return;

        try {
            const resp = await fetch(this.getApiBase() + "/api/schedules");
            this.schedules = await resp.json();
            this.loaded = true;
            this.populate();
        } catch (e) {
            console.error("Failed loading rundowns", e);
            this.select.innerHTML = `<option disabled>Error loading</option>`;
        }
    }

    populate() {
        if (!this.schedules?.length) {
            this.select.innerHTML = `<option disabled>No rundowns</option>`;
            return;
        }

        // 1. SORT NEWEST FIRST
        this.schedules.sort((a, b) => {
            const da = new Date(a.updatedAt ?? a.date ?? 0).getTime();
            const db = new Date(b.updatedAt ?? b.date ?? 0).getTime();
            return db - da; // newest first
        });

        this.select.innerHTML = "";

        const opt = document.createElement("option");
        opt.value = "placeholder"
        opt.id = "placeholder"
        opt.textContent = "Select Schedule..."
        this.select.appendChild(opt)

        // 2. BUILD OPTIONS
        this.schedules.forEach(r => {
            const opt = document.createElement("option");

            const id = r.id ?? r.id;
            const title = r.name ?? r.name;

            opt.value = id;
            opt.textContent = title;

            this.select.appendChild(opt);
        });
    }


    handleChange() {
        const id = this.select.value;
        const r = this.schedules.find(x =>
            String(x.id ?? x.id) === id
        );
        if (!r) return;

        this.dispatchEvent(new CustomEvent("selected", {
            detail: {
                name: r.name ?? r.name,
                id: r.id ?? r.id
            },
            bubbles: true
        }));

        document.getElementById("placeholder").remove()
    }
}

customElements.define("schedule-select", ScheduleSelect);

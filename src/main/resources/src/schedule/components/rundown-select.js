class RundownSelect extends HTMLElement {
    constructor() {
        super();
        this.rundowns = [];
        this.loaded = false;
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

        this.select.addEventListener("focus", () => this.loadRundowns(), { once: true });
        this.select.addEventListener("click", () => this.loadRundowns(), { once: true });
        this.select.addEventListener("change", () => this.handleChange());
    }

    async loadRundowns() {
        if (this.loaded) return;

        try {
            const resp = await fetch("/api/rundowns");
            this.rundowns = await resp.json();
            this.loaded = true;
            this.populate();
        } catch (e) {
            console.error("Failed loading rundowns", e);
            this.select.innerHTML = `<option disabled>Error loading</option>`;
        }
    }

    populate() {
        this.select.innerHTML = `<option disabled selected>Select Rundown</option>`;

        this.rundowns.forEach(r => {
            const opt = document.createElement("option");

            const id = r.rundownId ?? r.RundownID;
            const title = r.title ?? r.Title;

            opt.value = id;
            opt.textContent = title;

            this.select.appendChild(opt);
        });
    }

    handleChange() {
        const id = this.select.value;
        const r = this.rundowns.find(x =>
            String(x.rundownId ?? x.RundownID) === id
        );
        if (!r) return;

        this.dispatchEvent(new CustomEvent("selected", {
            detail: {
                title: r.title ?? r.Title,
                rundownId: r.rundownId ?? r.RundownID
            },
            bubbles: true
        }));
    }
}

customElements.define("rundown-select", RundownSelect);

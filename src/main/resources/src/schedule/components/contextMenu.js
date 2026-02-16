export const contextMenu = document.createElement("div");
contextMenu.id = "context-menu";
document.body.appendChild(contextMenu);

// ---------- STATE ----------
let menuEl = null;
let active = false;

// ---------- INIT ----------
function ensureMenu() {
    if (menuEl) return;

    menuEl = document.createElement("div");
    menuEl.id = "context-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.tabIndex = -1;

    document.body.appendChild(menuEl);

    document.addEventListener("click", closeContextMenu);
    document.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeContextMenu();
    });
}

// ---------- PUBLIC ----------
export function showContextMenu({ x, y, items = [] }) {
    ensureMenu();
    menuEl.innerHTML = "";

    items.forEach(item => {
        if (item.type === "separator") {
            const hr = document.createElement("hr");
            menuEl.appendChild(hr);
            return;
        }

        const btn = document.createElement("button");
        btn.setAttribute("role", "menuitem");
        btn.className = "menu-item";

        btn.textContent = item.label || "Unnamed";

        if (item.icon) {
            const icon = document.createElement("span");
            icon.className = "menu-icon";
            icon.innerHTML = item.icon;
            btn.prepend(icon);
        }

        if (item.danger) btn.classList.add("danger");
        if (item.disabled) btn.disabled = true;

        btn.onclick = e => {
            e.stopPropagation();
            if (!item.disabled && item.action) item.action();
            closeContextMenu();
        };

        menuEl.appendChild(btn);
    });

    // Measure after render
    menuEl.style.display = "flex";
    const rect = menuEl.getBoundingClientRect();
    const pos = clampMenu(x, y, rect.width + 16, rect.height);

    menuEl.style.left = pos.x + "px";
    menuEl.style.top = pos.y + "px";

    active = true;
    menuEl.focus();
}

export function closeContextMenu() {
    if (!menuEl || !active) return;
    menuEl.style.display = "none";
    active = false;
}

// ---------- HELPERS ----------
function clampMenu(x, y, w, h) {
    return {
        x: Math.min(x, window.innerWidth - w - 4),
        y: Math.min(y, window.innerHeight - h - 4)
    };
}

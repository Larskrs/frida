// ---------- ROOT ----------
let container = null;
let styleInjected = false;

// ---------- STATE ----------
const toasts = new Set();

// ---------- INIT ----------
function ensureContainer() {
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");
        document.body.appendChild(container);
    }

    if (!styleInjected) {
        injectStyles();
        styleInjected = true;
    }
}

function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        #toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 9999;
            pointer-events: none;
        }

        .toast {
            min-width: 260px;
            max-width: 360px;
            background: #111;
            outline: 1px solid #222;
            color: white;
            padding: 14px 16px;
            border-radius: 0px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            opacity: 0;
            transform: translateX(125%);
            transition: all 1s cubic-bezier(.03,1.17,.39,.99);
            pointer-events: auto;
            font-family: inherit;
        }

        .toast.visible {
            opacity: 1;
            transform: translateX(0);
        }

        .toast-success { border-left: 4px solid #22c55e; }
        .toast-error   { border-left: 4px solid #ef4444; }
        .toast-warning { border-left: 4px solid #f59e0b; }
        .toast-info    { border-left: 4px solid #3b82f6; }

        .toast-message {
            flex: 1;
            font-size: 0.8rem;
            color: #999
        }
        .toast-title {
            flex: 1;
            font-size: 1rem;
        }

        .toast-action {
            background: transparent;
            border: none;
            color: #3b82f6;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
        }

        .toast-close {
            background: transparent;
            border: none;
            color: #aaa;
            cursor: pointer;
            font-size: 16px;
        }

        .toast-close:hover {
            color: white;
        }
    `;
    document.head.appendChild(style);
}

// ---------- PUBLIC ----------
export function showToast({
                              title = "",
                              message = "",
                              type = "info", // success | error | warning | info
                              duration = 3000,
                              action = null,
                              persistent = false
                          } = {}) {

    ensureContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.tabIndex = 0;

    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = title;

    const msg = document.createElement("div");
    msg.className = "toast-message";
    msg.textContent = message;

    toast.appendChild(titleEl);
    toast.appendChild(msg);

    if (action?.label && action?.onClick) {
        const btn = document.createElement("button");
        btn.className = "toast-action";
        btn.textContent = action.label;

        btn.onclick = e => {
            e.stopPropagation();
            action.onClick();
            removeToast(toast);
        };

        toast.appendChild(btn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => removeToast(toast);

    container.appendChild(toast);
    toasts.add(toast);

    toast.getBoundingClientRect();

    toast.classList.add("visible");


    if (!persistent) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

export function removeToast(toast) {
    if (!toast || !toasts.has(toast)) return;

    toast.classList.remove("visible");

    setTimeout(() => {
        toast.remove();
        toasts.delete(toast);
    }, 200);
}

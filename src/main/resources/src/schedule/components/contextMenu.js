export const contextMenu = document.createElement("div");
contextMenu.id = "context-menu";
document.body.appendChild(contextMenu);

export function addMenuItem(label, fn, danger = false) {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (danger) btn.classList.add("danger");
    btn.onclick = () => {
        fn();
        closeContextMenu();
    };
    contextMenu.appendChild(btn);
}

export function closeContextMenu() {
    contextMenu.style.display = "none";
}
function clampMenu(x, y) {
    const w = 200;
    const h = 180;
    return {
        x: Math.min(x, window.innerWidth - w),
        y: Math.min(y, window.innerHeight - h)
    };
}


document.addEventListener("click", closeContextMenu);
document.addEventListener("scroll", closeContextMenu);
window.addEventListener("resize", closeContextMenu);

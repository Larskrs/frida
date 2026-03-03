export function createPromptRenderer(trackRef: any, scrollController: any) {

    const rows = new Map<number, any>()
    let sortedCache: any[] = []
    let currentIndex = 0

    function escapeHtml(str: string) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    function buildRowHtml(row: any) {
        const page = escapeHtml((row.page || "") + " - " + (row.title || ""))
        const script =
            escapeHtml(row.script ?? row.cells?.script?.value ?? "")

        return `
            <span class="page">${page}</span>
            <span class="script">${script}</span>
        `
    }

    function sortRows() {
        sortedCache = Array.from(rows.values())
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    function renderAll() {
        if (!trackRef.value) return

        sortRows()
        trackRef.value.innerHTML = ""

        for (const row of sortedCache) {
            const el = document.createElement("div")
            el.className = "row"
            el.dataset.rowId = row.id
            el.innerHTML = buildRowHtml(row)
            trackRef.value.appendChild(el)
        }

        highlightCurrent()
    }

    function renderSingle(rowId: number) {
        if (!trackRef.value) return

        const row = rows.get(rowId)
        if (!row) return

        const existing = trackRef.value.querySelector(
            `[data-row-id="${rowId}"]`
        ) as HTMLElement | null

        if (!existing) {
            renderAll()
            return
        }

        existing.innerHTML = buildRowHtml(row)
    }

    function highlightCurrent() {
        if (!trackRef.value) return

        const track = trackRef.value as HTMLElement

        const elements = track.querySelectorAll(".row")
        elements.forEach((el: any) => el.classList.remove("active"))

        const activeRow = sortedCache[currentIndex]
        if (!activeRow) return

        const el = track.querySelector(
            `[data-row-id="${activeRow.id}"]`
        ) as HTMLElement | null

        if (!el) return

        el.classList.add("active")

        const viewportHeight = window.innerHeight
        const undershoot = viewportHeight * 0.15

        const rowTop = el.offsetTop

        const targetY = -(rowTop - undershoot)

        scrollController.jumpTo(targetY) // <- use your scroll instance
    }

    function jumpRelative(delta: number) {
        if (!sortedCache.length) return

        currentIndex += delta

        if (currentIndex < 0) currentIndex = 0
        if (currentIndex >= sortedCache.length)
            currentIndex = sortedCache.length - 1

        highlightCurrent()
    }

    function jumpToIndex(index: number) {
        if (!sortedCache.length) return
        if (index < 0 || index >= sortedCache.length) return

        currentIndex = index
        highlightCurrent()
    }

    return {
        rows,
        renderAll,
        renderSingle,
        jumpRelative,
        jumpToIndex
    }
}
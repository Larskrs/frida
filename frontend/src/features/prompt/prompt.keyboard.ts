export function attachPromptKeyboard(scroll: any, jump: (i: number) => void) {

    function onKeyDown(e: KeyboardEvent) {

        if (e.code === "ArrowRight") jump(1)
        if (e.code === "ArrowLeft") jump(-1)

        if (e.code === "Space") {
            scroll.stopMotion()
        }

        if (e.code === "ArrowDown") scroll.adjustSpeed(5)
        if (e.code === "ArrowUp") scroll.adjustSpeed(-5)
    }

    function onWheel(e: WheelEvent) {
        scroll.adjustSpeed(e.deltaY * -0.05)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("wheel", onWheel, { passive: true })

    return () => {
        window.removeEventListener("keydown", onKeyDown)
        window.removeEventListener("wheel", onWheel)
    }
}
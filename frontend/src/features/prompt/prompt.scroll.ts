export function createPromptScroll(trackRef: any) {

    let speed = 0
    let velocity = 0
    let y = 0
    let lastT = performance.now()
    let frame: number | null = null

    function clamp() {
        if (!trackRef.value) return

        const stageH = window.innerHeight
        const contentH = trackRef.value.scrollHeight

        const minY = Math.min(0, stageH - contentH - 40)
        const maxY = 0

        if (y < minY) y = minY
        if (y > maxY) y = maxY
    }

    function apply() {
        if (!trackRef.value) return
        trackRef.value.style.transform = `translate3d(0, ${y}px, 0)`
    }

    function tick(now: number) {
        const dt = Math.min(0.5, (now - lastT) / 1000)
        lastT = now

        const targetVelocity = -speed * 10
        velocity += (targetVelocity - velocity) * (1 - Math.exp(-8 * dt))
        y += velocity * dt

        clamp()
        apply()

        frame = requestAnimationFrame(tick)
    }

    function start() {
        frame = requestAnimationFrame(tick)
    }

    function stop() {
        if (frame) cancelAnimationFrame(frame)
    }

    function adjustSpeed(delta: number) {
        speed += delta
        speed = Math.max(-500, Math.min(500, speed))
    }

    function stopMotion() {
        speed = 0
        velocity = 0
    }

    function jumpTo(targetY: number) {
        y = targetY
        velocity = -100
        clamp()
        apply()
    }

    return {
        start,
        stop,
        adjustSpeed,
        stopMotion,
        jumpTo
    }
}
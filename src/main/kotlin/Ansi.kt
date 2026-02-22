package com.example

object Ansi {
    const val RESET = "\u001B[0m"
    const val RED = "\u001B[31m"
    const val GREEN = "\u001B[32m"
    const val YELLOW = "\u001B[33m"
    const val CYAN = "\u001B[36m"
    const val BOLD = "\u001B[1m"

    @Volatile
    private var loading = false

    fun startDots(prefix: String = "Loading") {
        loading = true
        Thread {
            var i = 0
            while (loading) {
                val dots = ".".repeat(i % 4)
                print("\r$CYAN$prefix$dots   $RESET")
                Thread.sleep(300)
                i++
            }
        }.start()
    }

    fun stopDots() {
        loading = false
        print("\r") // clear line position
    }
}

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue"

import { createPromptSocket } from "./prompt.socket"
import { createPromptRenderer } from "./prompt.renderer"
import { createPromptScroll } from "./prompt.scroll"
import { attachPromptKeyboard } from "./prompt.keyboard"

const params = new URLSearchParams(location.search)
const scheduleId = Number(params.get("id") || 1)

const trackRef = ref<HTMLDivElement | null>(null)

const scroll = createPromptScroll(trackRef)
const renderer = createPromptRenderer(trackRef, scroll)
const ws = createPromptSocket()

let detachKeyboard: (() => void) | null = null

function jumpRelative(_delta: number) {
  const size = renderer.rows.size
  if (!size) return
  renderer.renderAll()
  renderer.jumpRelative(_delta)
}

function buildColumnMap(columns: any[]) {
  const find = (name: string) => columns.find((c: any) => c.system && c.name === name)?.id ?? null
  return {
    pageColId:   find("page"),
    titleColId:  find("title"),
    scriptColId: find("script"),
  }
}

onMounted(() => {

  ws.on("message", (event) => {
    if (!event?.type) return

    const type = event.type.split(".").pop()

    switch (type) {
      case "Load":
        renderer.rows.clear()
        event.schedule?.rows?.forEach((r: any) => {
          renderer.rows.set(r.id, r)
        })
        renderer.setColumnMap(buildColumnMap(event.schedule?.columns ?? []))
        renderer.renderAll()
        break

      case "RowEdited": {
        if (!event.rowId) return
        const row = renderer.rows.get(event.rowId)
        if (!row) return

        row.cells ??= {}
        row.cells[event.columnId!] = event.cell

        renderer.renderSingle(event.rowId)
        break
      }

      case "RowDelete":
        renderer.rows.delete(event.rowId!)
        renderer.renderAll()
        break
    }
  })

  ws.connect(scheduleId)
  scroll.start()

  detachKeyboard = attachPromptKeyboard(scroll, jumpRelative)
})

onBeforeUnmount(() => {
  ws.disconnect()
  scroll.stop()
  detachKeyboard?.()
})
</script>

<template>
  <div class="stage">
    <div class="track" ref="trackRef"></div>

    <svg
        class="arrow"
        xmlns="http://www.w3.org/2000/svg"
        fill="#fff"
        width="120px"
        height="120px"
        viewBox="-2 0 32 32"
    >
      <path d="M0 24.781v-17.594l15.281 8.813z" />
    </svg>
  </div>
</template>

<style src="./prompt.style.css"></style>
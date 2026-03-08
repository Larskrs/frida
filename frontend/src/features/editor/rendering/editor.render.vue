<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from "vue"
import { useRoute } from 'vue-router'
import { editorStore, editorUI } from "../editor.store"
import { createEditorSocket } from "../editor.socket"
import { useEditorSocket } from "../useEditorSocket"
import { useModal } from "../../../components/composables/useModal"
import FridaModal from "../../../components/Modal.vue"
import EditorNav from "./editor.nav.vue"
import EditorTable from "./editor.table.vue"

const importId = ref("")
const modals = useModal()

const route = useRoute()
const scheduleId = computed(() => Number(route.query.id || 1))

const socket = createEditorSocket()
useEditorSocket(socket)

onMounted(() => socket.connect(scheduleId.value))
onBeforeUnmount(() => socket.disconnect())

watch(scheduleId, async (newId) => {
  await socket.disconnect()
  socket.connect(newId)
})

function sendRowEdit(rowId: number, key: string, value: any) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.RowEdited", scheduleId: editorStore.schedule?.id, rowId, key, value })
}
function sendCellEdit(rowId: number, columnId: number, cell: any) {
  console.log("called cell edit")
  socket.send({ type: "com.example.websocket.ScheduleEvent.RowEdited", scheduleId: editorStore.schedule?.id, rowId, columnId, cell })
}
function sendColumnEdit(id: number, name: string) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.ColumnEdited", scheduleId: scheduleId.value, columnId: id, name, columnType: "Text" })
}
function sendColumnCreate(order: number) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.ColumnCreate", scheduleId: scheduleId.value, order: order + 1, name: "New Column", columnType: "Text" })
}
function sendColumnDelete(id: number) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.ColumnDelete", scheduleId: scheduleId.value, columnId: id })
}
function sendRowCreate() {
  socket.send({ type: "com.example.websocket.ScheduleEvent.RowCreate", scheduleId: scheduleId.value, order: editorStore.rows.length })
}
function sendRowDelete(id: number) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.RowDelete", scheduleId: editorStore.schedule?.id, rowId: id })
}
function sendSetActiveRow(id: number) {
  socket.send({ type: "com.example.websocket.ScheduleEvent.ActiveRowChanged", scheduleId: editorStore.schedule?.id, rowId: id })
}

async function runImport() {
  const numId = Number(importId.value)
  if (!numId || isNaN(numId)) return { ok: false, error: "Please enter a valid numeric ID." }
  const res = await fetch(`/api/schedule/import/rc/${numId}`, { method: "POST" })
  console.log(await res.json())
  return res.ok ? true : { ok: false, error: `Import failed (${res.status})` }
}
</script>

<template>
  <FridaModal
      id="import-rc"
      title="Import RC Schedule"
      size="sm"
      cancel-label="Cancel"
      action-label="Import"
      action-loading-label="Importing…"
      :action="runImport"
  >
    <template #default>
      <label class="block text-sm font-medium text-stone-700 mb-1">RC Schedule ID</label>
      <input
          v-model="importId"
          type="number"
          placeholder="e.g. 42"
          class="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:border-amber-700 focus:bg-white transition-colors"
      />
    </template>
  </FridaModal>

  <div
    class="fixed inset-0 min-h-screen grid bg-bg text-text"
    :class="editorUI.sidebarCollapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]'"
    >

    <EditorNav
        :schedule-id="scheduleId"
        @import-click="modals.open('import-rc')"
    />

<Transition name="fade" mode="out-in">
      <main v-if="!editorStore.schedule" key="loading" class="col-start-2 p-4 flex items-center justify-center text-text-muted">
        <div class="spinner" />
        <span>Loading schedule…</span>
      </main>

      <main v-else :key="scheduleId" class="h-screen overflow-y-auto col-start-2 p-4">
        <nav class="mb-4">
          <h1 class="text-xl font-bold text-primary">{{ editorStore.schedule.name }}</h1>
        </nav>

        <EditorTable
            :schedule-id="scheduleId"
            @row-edit="sendRowEdit"
            @cell-edit="sendCellEdit"
            @column-edit="sendColumnEdit"
            @column-create="sendColumnCreate"
            @column-delete="sendColumnDelete"
            @row-create="sendRowCreate"
            @row-delete="sendRowDelete"
            @set-active-row="sendSetActiveRow"
        />
      </main>
    </Transition>

  </div>
</template>
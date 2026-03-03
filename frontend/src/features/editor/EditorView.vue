<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue"

import { useContextMenu} from "../../components/contextMenu/useContextMenu.ts";
import { resolveInput } from "../../components/inputs"
import { editorStore } from "./editor.store"
import { createEditorSocket } from "./editor.socket"
import { useEditorSocket } from "./useEditorSocket"

import Button from "../../components/basic/Button.vue";
import ScheduleList from "@/components/ScheduleList.vue";

const params = new URLSearchParams(location.search)
const scheduleId = Number(params.get("id") || 1)

const socket = createEditorSocket()

useEditorSocket(socket)

onMounted(() => {
  socket.connect(scheduleId)
})

onBeforeUnmount(() => {
  socket.disconnect()
})

const { show } = useContextMenu()

function openColumnMenu(e: MouseEvent, col: any) {
  e.preventDefault()

  show(e.clientX, e.clientY, [
    { label: "Create After", icon: "ix:table-add-column-right", action: () => sendCreateNewColumn(col.order+1) },
    { label: "Delete Column", icon: "lucide:delete", danger: true, action: () => sendDeleteColumn(col.columnId) }
  ], e.currentTarget as HTMLElement)
}

function openRowMenu(e: MouseEvent, row: any) {
  e.preventDefault()

  show(e.clientX, e.clientY, [
    { label: "Delete Row", icon: "lucide:delete", danger: true, action: () => sendDeleteRow(row.id) }
  ])
}

function sendDeleteRow(id: number) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.RowDelete",
    scheduleId: editorStore.schedule?.id,
    rowId: id,
  })
}
function sendCreateNewColumn(order: number) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.ColumnCreate",
    scheduleId: scheduleId,
    order: order,
    name: "New Column",
    columnType: "Text"
  });
}
function sendDeleteColumn(id: number) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.ColumnDelete",
    scheduleId: scheduleId,
    columnId: id
  });
}
function sendColumnEdit(id: number, newName: string) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.ColumnEdited",
    scheduleId: scheduleId,
    columnId: id,
    name: newName,
    columnType: "Text"
  })
}

function getCellValue(row: any, columnId: number) {
  return row.cells?.[columnId]?.value ?? ""
}

function setCellValue(row: any, columnId: number, value: any) {
  if (!row.cells) row.cells = {}

  if (!row.cells[columnId]) {
    row.cells[columnId] = {
      type: "Text",
      value: ""
    }
  }

  row.cells[columnId].value = value

  sendCellEdit(row.id, columnId, row.cells[columnId])
}


/* ---------- Computed ---------- */

const sortedRows = computed(() =>
    [...editorStore.rows].sort((a, b) => a.order - b.order)
)

function sendRowEdit(rowId: number, key: string, value: any) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.RowEdited",
    scheduleId: editorStore.schedule?.id,
    rowId,
    key,
    value
  })
}

function sendCellEdit(rowId: number, columnId: number, cell: any) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.RowEdited",
    scheduleId: editorStore.schedule?.id,
    rowId,
    columnId,
    cell
  })
}
</script>

<template>
  <div class="min-h-screen grid grid-cols-[16rem_1fr] bg-bg text-text p-">

    <!-- NAV -->
    <nav class="flex flex-col items-start justify-start">
      <div class="flex flex-col items-start justify-start gap-2">
        <RouterLink
            class="w-full text-sm px-3 py-1 rounded-md hover:bg-muted w-full"
            :to="`/prompt?id=${scheduleId}`"
        >
          Prompt
        </RouterLink>
      </div>

      <ScheduleList></ScheduleList>

      <div class="flex flex-row gap-2 p-4 mt-auto">
        <RouterLink
            :to="`/prompt?id=${scheduleId}`"
        >
          <Button class="cursor-pointer">Open Prompt</Button>
        </RouterLink>
      </div>
    </nav>

    <main v-if="!editorStore.schedule" class="p-4 border-l border-border flex items-center justify-center text-text-muted">
      <div class="spinner" />
      <span>Loading schedule…</span>
    </main>

    <main v-else class="p-4 border-l border-border">
      <!-- TABLE WRAPPER -->
      <nav class="mb-4">
        <h1>{{ editorStore.schedule.name }}</h1>
      </nav>

      <div class="bg-surface h-fit w-fit rounded-xl border border-border shadow-xl shadow-border-subtle overflow-hidden">

      <div class="overflow-x-auto w-fit">
        <table class="text-sm border-collapse table-auto">

          <!-- HEADER -->
          <thead class="bg-muted">
          <tr>
            <th
                v-for="col in editorStore.columns"
                :key="col.columnId ?? col.key"
                :contenteditable="!!col.columnId"
                @blur="(e) => col.columnId && sendColumnEdit(col.columnId, (e.target as HTMLElement).innerText.trim())"
                @contextmenu="(e) => openColumnMenu(e, col)"
                class="px-4 py-2 text-left font-semibold text-text-muted uppercase tracking-wide select-none"
            >
              <template v-if="col.top">
                <span>{{ col.key.toUpperCase() }}</span>
              </template>

              <template v-else>
                {{ col.name }}
              </template>
            </th>
          </tr>
          </thead>

          <!-- BODY -->
          <tbody>
          <tr
              v-for="row in sortedRows"
              :key="row.id"
              @contextmenu="(e) => openRowMenu(e, row)"
              :class="[
                'transition-colors',
                row.id === editorStore.activeRowId
                  ? 'bg-brand/10 border-l-4 border-brand'
                  : 'hover:bg-muted'
              ]"
          >
            <td
                v-for="col in editorStore.columns"
                :key="col.columnId ?? col.key"
                class="align-middle w-px whitespace-nowrap"
            >

              <template v-if="col.top">
                <Component
                    :is="resolveInput(col.type)"
                    v-model="row[col.key]"
                    @update:modelValue="(val: any) => sendRowEdit(row.id, col.key, val)"
                />
              </template>

              <!-- CELLS -->
              <template v-else>
                <Component
                    :is="resolveInput(col.type)"
                    :modelValue="getCellValue(row, col.columnId)"
                    @update:modelValue="(val: any) => setCellValue(row, col.columnId, val)"
                />
              </template>

            </td>
          </tr>
          </tbody>

        </table>
      </div>

      <!-- CREATE ROW BUTTON -->
      <div class="p-3 border-t border-border">
        <Button
            class="px-4 py-2 text-sm font-medium bg-muted text-white rounded-lg hover:bg-primary hover:text-muted cursor-pointer transition shadow-sm"
            @click="socket.send({
              type: 'com.example.websocket.ScheduleEvent.RowCreate',
              scheduleId: scheduleId,
              order: sortedRows.length
            })"
        >
          Create Row
        </Button>
      </div>

    </div>
    </main>
  </div>
</template>
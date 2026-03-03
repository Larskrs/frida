<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue"

import { useContextMenu} from "../../components/contextMenu/useContextMenu.ts";
import { resolveInput } from "../../components/inputs"
import { editorStore } from "./editor.store"
import { createEditorSocket } from "./editor.socket"
import { useEditorSocket } from "./useEditorSocket"

import Button from "../../components/basic/Button.vue";

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
    { label: "Create After", icon: "ix:table-add-column-right", action: () => alert(col.order) },
    { label: "Delete Column", icon: "lucide:delete", danger: true, action: () => alert(col.columnId) }
  ], e.currentTarget as HTMLElement)
}

function openRowMenu(e: MouseEvent, row: any) {
  e.preventDefault()

  show(e.clientX, e.clientY, [
    { label: "Delete Row", icon: "lucide:delete", danger: true, action: () => sendDeleteRow(row.id) }
  ])
}

function sendDeleteRow(id) {
  socket.send({
    type: "com.example.websocket.ScheduleEvent.RowDelete",
    scheduleId: editorStore.schedule?.id,
    rowId: id,
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
  <div class="min-h-screen bg-bg text-text p-8">

    <!-- NAV -->
    <nav class="flex items-center justify-between mb-6">
      <RouterLink
          :to="`/prompt?id=${scheduleId}`"
      >
        <Button class="cursor-pointer">Open Prompt</Button>
      </RouterLink>
    </nav>

    <!-- TABLE WRAPPER -->
    <div class="bg-surface w-fit rounded-xl border border-border shadow-xl shadow-border-subtle overflow-hidden">

      <div class="overflow-x-auto w-fit">
        <table class="text-sm border-collapse table-auto">

          <!-- HEADER -->
          <thead class="bg-muted">
          <tr>
            <th
                v-for="col in editorStore.columns"
                :key="col.columnId ?? col.key"
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
      <div class="p-4 border-t border-border">
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
  </div>
</template>
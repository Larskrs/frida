<script setup lang="ts">
import { computed } from "vue"
import { resolveInput } from "../../../components/inputs"
import { editorStore } from "../editor.store"
import { useContextMenu } from "../../../components/contextMenu/useContextMenu.ts"
import Button from "../../../components/basic/Button.vue"
import {Icon} from "@iconify/vue";

const emit = defineEmits<{
  (e: "columnEdit", id: number, name: string): void
  (e: "columnCreate", order: number): void
  (e: "columnDelete", id: number): void
  (e: "cellEdit", rowId: number, columnId: number, cell: any): void
  (e: "rowCreate"): void
  (e: "rowDelete", id: number): void
  (e: "setActiveRow", id: number): void
}>()

const { show } = useContextMenu()

const sortedRows = computed(() =>
    [...editorStore.rows].sort((a, b) => a.order - b.order)
)

function getCellValue(row: any, columnId: number) {
  const cell = row.cells?.[columnId] ?? row.cells?.[String(columnId)]
  if (!cell) return ""
  return cell.value ?? ""
}

function setCellValue(row: any, columnId: number, value: any) {
  if (!row.cells) row.cells = {}

  const existing = row.cells[columnId] ?? row.cells[String(columnId)]
  const type = existing?.type ?? "Text"

  const cell = { type, value }
  row.cells[columnId] = cell

  emit("cellEdit", row.id, columnId, cell)
}

function openColumnMenu(e: MouseEvent, col: any) {
  e.preventDefault()

  const items = [
    { label: "Create After", icon: "ix:table-add-column-right", action: () => emit("columnCreate", col.order) },
  ]

  // System columns cannot be deleted or renamed
  if (!col.system) {
    items.push({ label: "Delete Column", icon: "lucide:delete", action: () => emit("columnDelete", col.columnId) })
  }

  show(e.clientX, e.clientY, items, e.currentTarget as HTMLElement)
}

function openRowMenu(e: MouseEvent, row: any) {
  e.preventDefault()
  show(e.clientX, e.clientY, [
    { label: "Activate Row", icon: "lucide:play", action: () => emit("setActiveRow", row.id) },
    { label: "Delete Row", icon: "lucide:delete", danger: true, action: () => emit("rowDelete", row.id) }
  ])
}
</script>

<template>
  <div class="bg-bg border border-border h-fit w-fit rounded-xl overflow-hidden">
    <div class="overflow-x-auto w-fit">
      <table class="text-sm border-collapse table-auto">

        <thead class="bg-muted">
        <tr>
          <th
              v-for="col in editorStore.columns"
              :key="col.columnId"
              :contenteditable="!col.system"
              @blur="(e) => !col.system && emit('columnEdit', col.columnId, (e.target as HTMLElement).innerText.trim())"
              @contextmenu="(e) => openColumnMenu(e, col)"
              class="px-4 py-2 text-left font-semibold text-text-muted uppercase tracking-wide select-none"
          >
            <span class="flex items-center gap-1.5">
              {{ col.name }}
              <Icon v-if="col.system" icon="material-symbols-light:lock-outline" class="w-4 h-4 shrink-0 -translate-y-0.25" />
            </span>
          </th>
        </tr>
        </thead>

        <tbody>
        <tr
            v-for="row in sortedRows"
            :key="row.id"
            @contextmenu="(e) => openRowMenu(e, row)"
            :class="[
                'transition-colors duration-25',
                row.id === editorStore.activeRowId
                  ? 'bg-active/25'
                  : 'hover:bg-bg-hover'
              ]"
        >
          <td
              v-for="col in editorStore.columns"
              :key="col.columnId"
              class="h-px align-middle w-px whitespace-nowrap"
              @click="(e) => (e.currentTarget as HTMLElement).querySelector<HTMLElement>('input, textarea, select, [contenteditable]')?.focus()"
          >
            <Component
                :is="resolveInput(col.type)"
                :modelValue="getCellValue(row, col.columnId)"
                @update:modelValue="(val: any) => setCellValue(row, col.columnId, val)"
            />
          </td>
        </tr>
        </tbody>

      </table>
    </div>

    <div class="p-3 border-t border-border">
      <Button
          class="px-3 py-1.5 text-sm font-medium bg-muted text-white rounded-lg hover:bg-primary hover:text-muted cursor-pointer transition shadow-sm"
          @click="emit('rowCreate')"
      >
        Create Row
      </Button>
    </div>
  </div>
</template>
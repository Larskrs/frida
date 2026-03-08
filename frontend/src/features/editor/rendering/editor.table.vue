<script setup lang="ts">
import { computed } from "vue"
import { resolveInput } from "../../../components/inputs"
import { editorStore } from "../editor.store"
import { useContextMenu } from "../../../components/contextMenu/useContextMenu.ts"
import Button from "../../../components/basic/Button.vue"

const props = defineProps<{ scheduleId: number }>()
const emit = defineEmits<{
  (e: "columnEdit", id: number, name: string): void
  (e: "columnCreate", order: number): void
  (e: "columnDelete", id: number): void
  (e: "rowEdit", rowId: number, key: string, value: any): void
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
  return row.cells?.[columnId]?.value ?? ""
}

function setCellValue(row: any, columnId: number, value: any) {
  if (!row.cells) row.cells = {}
  if (!row.cells[columnId]) row.cells[columnId] = { type: "Text", value: "" }
  row.cells[columnId].value = value
  emit("cellEdit", row.id, columnId, row.cells[columnId])
}

function openColumnMenu(e: MouseEvent, col: any) {
  e.preventDefault()
  show(e.clientX, e.clientY, [
    { label: "Create After", icon: "ix:table-add-column-right", action: () => emit("columnCreate", col.order) },
    { label: "Delete Column", icon: "lucide:delete", danger: true, action: () => emit("columnDelete", col.columnId) }
  ], e.currentTarget as HTMLElement)
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
                :key="col.columnId ?? col.key"
                :contenteditable="!!col.columnId"
                @blur="(e) => col.columnId && emit('columnEdit', col.columnId, (e.target as HTMLElement).innerText.trim())"
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

        <tbody>
          <tr
              v-for="row in sortedRows"
              :key="row.id"
              @contextmenu="(e) => openRowMenu(e, row)"
              :class="[
                'transition-colors',
                row.id === editorStore.activeRowId
                  ? 'bg-active/25 border-l-4 border-active/75'
                  : 'hover:bg-muted'
              ]"
          >
            <td
                v-for="col in editorStore.columns"
                :key="col.columnId ?? col.key"
                class="h-px align-middle w-px whitespace-nowrap"
                @click="(e) => (e.currentTarget as HTMLElement).querySelector<HTMLElement>('input, textarea, select, [contenteditable]')?.focus()"
            >
              <template v-if="col.top">
                <Component
                    :is="resolveInput(col.type)"
                    v-model="row[col.key]"
                    @update:modelValue="(val: any) => emit('rowEdit', row.id, col.key, val)"
                />
              </template>
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
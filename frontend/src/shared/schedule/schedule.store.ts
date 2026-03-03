// src/shared/schedule/schedule.store.ts

import { reactive } from "vue"

export const scheduleStore = reactive({
    rows: new Map<number, any>(),
    activeRowId: null as number | null,

    setRows(rows: any[]) {
        this.rows.clear()
        rows.forEach(r => this.rows.set(r.id, r))
    },

    updateRow(rowId: number, patch: any) {
        const row = this.rows.get(rowId)
        if (!row) return
        Object.assign(row, patch)
    },

    deleteRow(rowId: number) {
        this.rows.delete(rowId)
    }
})
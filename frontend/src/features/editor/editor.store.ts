import { reactive } from "vue"

export const editorStore = reactive({
    schedule: null as any,
    rows: [] as any[],
    columns: [] as any[],
    activeRowId: null as number | null
})
import { reactive } from "vue"
import { WebSocketManager } from "../../shared/network/WebSocketManager.ts"
import type { EditorEvent } from "./editor.types.ts"

interface EditorUI {
    sidebarCollapsed: boolean
}

interface EditorData {
    schedule: any
    rows: any[]
    columns: any[]
    activeRowId: number | null
    socket: WebSocketManager<EditorEvent> | null
}

export const editorUI = reactive<EditorUI>({
    sidebarCollapsed: false
})

export const editorStore = reactive<EditorData>({
    schedule: null,
    rows: [],
    columns: [],
    activeRowId: null,
    socket: null
})
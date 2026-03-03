import { reactive } from "vue"
import {WebSocketManager} from "../../shared/network/WebSocketManager.ts";
import type {EditorEvent} from "./editor.types.ts";

export const editorStore = reactive({
    schedule: null as any,
    rows: [] as any[],
    columns: [] as any[],
    activeRowId: null as number | null,
    socket: WebSocketManager<EditorEvent>
})
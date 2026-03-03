import { WebSocketManager } from "../../shared/network/WebSocketManager"
import type { EditorEvent } from "./editor.types"

export function createEditorSocket() {

    const proto = location.protocol === "https:" ? "wss" : "ws"

    return new WebSocketManager<EditorEvent>(
        (id) => `${proto}://${location.host}/schedule/ws/${id}`,
        { debug: true }
    )
}
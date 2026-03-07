import { editorStore } from "./editor.store"
import { buildColumns } from "./editor.columns"
import type { EditorEvent } from "./editor.types"
import type { WebSocketManager } from "../../shared/network/WebSocketManager"

export function useEditorSocket(socket: WebSocketManager<EditorEvent>) {

    socket.on("message", (event) => {

        const type = event.type?.split(".").pop()

        switch (type) {

            case "Load":
                editorStore.schedule = event.schedule
                editorStore.rows = [...event.schedule.rows]
                editorStore.columns = buildColumns(event.schedule)
                editorStore.activeRowId = event.schedule.activeRowId
                break

            case "RowEdited": {
                const row = editorStore.rows.find(r => r.id === event.rowId)
                if (!row) return

                if (!event.cell) {
                    row[event.key!] = event.value
                } else {
                    row.cells ??= {}
                    row.cells[event.columnId!] = event.cell
                }
                break
            }

            case "RowCreate":
                editorStore.rows.push(event.row)
                break

            case "RowDelete":
                editorStore.rows = editorStore.rows.filter(r => r.id !== event.rowId)
                break

            case "ActiveRowChanged":
                editorStore.activeRowId = event.rowId
                break

            case "ColumnEdited": {
                const index = editorStore.columns.findIndex(c => c.columnId === event.columnId)
                if (index === -1) return

                editorStore.columns[index] = {
                    ...editorStore.columns[index],
                    name: event.name,
                    type: event.type
                }
                break
            }
        }
    })
}
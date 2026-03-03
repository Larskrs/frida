// src/shared/schedule/schedule.socket.ts

import { WebSocketManager } from "../network/WebSocketManager.ts"
import { scheduleStore } from "./schedule.store"

export function createScheduleSocket() {

    const proto = location.protocol === "https:" ? "wss" : "ws"

    const ws = new WebSocketManager(
        (id) => `${proto}://${location.host}/schedule/ws/${id}`,
        { retryDelay: 1000 }
    )

    ws.on("message", (event) => {
        const type = event?.type?.split(".").pop()

        switch (type) {
            case "Load":
                scheduleStore.setRows(event.schedule.rows || [])
                break

            case "RowEdited":
                scheduleStore.updateRow(event.rowId, {
                    [event.key]: event.value
                })
                break

            case "RowCreate":
                scheduleStore.rows.set(event.row.id, event.row)
                break

            case "RowDelete":
                scheduleStore.deleteRow(event.rowId)
                break

            case "ActiveRowChanged":
                scheduleStore.activeRowId = event.rowId
                break
        }
    })

    return ws
}
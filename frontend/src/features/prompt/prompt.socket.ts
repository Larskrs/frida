import {WebSocketManager} from "../../shared/network/WebSocketManager"
import type {ScheduleEvent} from "./prompt.types"

export function createPromptSocket() {

    const proto = location.protocol === "https:" ? "wss" : "ws"

    return new WebSocketManager<ScheduleEvent>(
        (id) => `${proto}://${location.host}/schedule/ws/${id}`,
        {retryDelay: 1000}
    )
}
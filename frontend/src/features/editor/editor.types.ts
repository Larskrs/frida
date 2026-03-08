export interface EditorEvent {
    type: string
    scheduleId?: number
    schedule?: any
    row?: any
    rowId?: number
    columnId?: number
    cell?: any
    name?: string
    columnType?: string
    order?: number
    activatedAt?: number
    programStart?: number
}
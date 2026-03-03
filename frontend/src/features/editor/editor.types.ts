export interface EditorEvent {
    type: string
    schedule?: any
    rowId?: number
    key?: string
    value?: any
    columnId?: number
    cell?: any
    name?: string
    columnType?: string
    activatedAt?: number
}
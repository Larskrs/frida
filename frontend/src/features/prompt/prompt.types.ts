export interface ScheduleEvent {
    type: string
    rowId?: number
    columnId?: number
    cell?: any
    row?: any
    schedule?: {
        rows: any[]
        columns: any[]
    }
}

export interface ColumnMap {
    pageColId: number | null
    titleColId: number | null
    scriptColId: number | null
}
export interface ScheduleEvent {
    type: string
    rowId?: number
    key?: string
    value?: any
    cell?: any
    row?: any
    schedule?: {
        rows: any[]
    }
}
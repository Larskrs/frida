export function buildColumns(schedule: any) {

    const topFields = [
        { key: "page", type: "Text", top: true },
        { key: "title", type: "Text", top: true },
        { key: "duration", type: "Duration", top: true },
        //{ key: "activatedAt", type: "Time", top: true }
    ]

    const dbColumns = schedule.columns
        .sort((a: any, b: any) => a.order - b.order)
        .map((col: any) => ({
            columnId: col.id,
            name: col.name,
            type: col.type,
            order: col.order,
            top: false
        }))

    return [...topFields, ...dbColumns]
}
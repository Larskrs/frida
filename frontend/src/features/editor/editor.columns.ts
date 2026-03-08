export function buildColumns(schedule: any) {
    return schedule.columns
        .slice()
        .sort((a: any, b: any) => a.order - b.order)
        .map((col: any) => ({
            columnId: col.id,
            name: col.name,
            type: col.type,
            order: col.order,
            system: col.system,
        }))
}
import { reactive } from "vue"

interface MenuItem {
    label?: string
    icon?: string
    danger?: boolean
    disabled?: boolean
    type?: "separator"
    action?: () => void
}

const state = reactive({
    visible: false,
    x: 0,
    y: 0,
    items: [] as MenuItem[]
})

function show(x: number, y: number, items: MenuItem[]) {
    state.x = x
    state.y = y
    state.items = items
    state.visible = true
}

function close() {
    state.visible = false
}

export function useContextMenu() {
    return {
        state,
        show,
        close
    }
}
<script setup lang="ts">
import { Icon } from "@iconify/vue"
import ScheduleList from "@/components/ScheduleList.vue"
import { editorUI } from "../editor.store"

const props = defineProps<{ scheduleId: number }>()
const emit = defineEmits<{
  (e: "importClick"): void
}>()

interface NavLink {
  type: "link"
  label: string
  icon: string
  to: string | ((scheduleId: number) => string)
}

interface NavButton {
  type: "button"
  label: string
  icon: string
  action: string
}

type NavItem = NavLink | NavButton

const navItems: NavItem[] = [
  {
    type: "link",
    label: "Prompter",
    icon: "material-symbols-light:featured-play-list-outline-rounded",
    to: (id) => `/prompt?id=${id}`
  },
  {
    type: "button",
    label: "Hent fra RundownCreator",
    icon: "material-symbols-light:cloud-download-outline-rounded",
    action: "importClick"
  }
]

function handleAction(action: string) {
  emit(action as any)
}

function resolveLink(to: NavLink["to"]): string {
  return typeof to === "function" ? to(props.scheduleId) : to
}
</script>

<template>
  <nav
      :class="editorUI.sidebarCollapsed ? 'w-14' : 'w-64'"
      class="transition-all duration-300 border-r border-border h-screen flex flex-col items-center justify-start overflow-hidden"
  >
    <!-- Logo -->
    <div
        :class="editorUI.sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'"
        class="w-full flex items-center mt-4 mb-2 gap-2"
    >
      <div v-if="!editorUI.sidebarCollapsed" class="flex items-center gap-2">
        <span class="font-medium text-lg tracking-tight text-text/80">Kari</span>
        <span class="text-xs text-active font-bold bg-active/15 px-1.5 py-0.5 rounded">Kjøreplan</span>
      </div>

      <!-- Toggle button -->
      <button
          @click="editorUI.sidebarCollapsed = !editorUI.sidebarCollapsed"
          class="cursor-pointer p-1.5 rounded-md hover:bg-muted text-text-muted shrink-0"
          :title="editorUI.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <Icon
            class="w-6 h-6 text-text"
            :icon="editorUI.sidebarCollapsed
              ? 'material-symbols-light:right-panel-open-outline-rounded'
              : 'material-symbols-light:right-panel-close-outline-rounded'"
        />
      </button>
    </div>

    <!-- Nav items -->
    <div class="w-full flex flex-col items-start px-2 mt-4 mb-4 justify-start gap-0.5">
      <template v-for="item in navItems" :key="item.label">

        <RouterLink
            v-if="item.type === 'link'"
            :to="resolveLink(item.to)"
            :class="editorUI.sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-2'"
            :title="editorUI.sidebarCollapsed ? item.label : undefined"
            class="w-full text-sm py-1 rounded-md hover:bg-muted flex flex-row gap-2 items-center transition-all"
        >
          <Icon class="size-6 shrink-0" :icon="item.icon" />
          <span v-if="!editorUI.sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>

        <button
            v-else-if="item.type === 'button'"
            @click="handleAction(item.action)"
            :class="editorUI.sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-2'"
            :title="editorUI.sidebarCollapsed ? item.label : undefined"
            class="cursor-pointer flex flex-row gap-2 items-center w-full text-sm py-1 rounded-md hover:bg-muted transition-all"
        >
          <Icon class="size-6 shrink-0" :icon="item.icon" />
          <span v-if="!editorUI.sidebarCollapsed">{{ item.label }}</span>
        </button>

      </template>
    </div>

    <ScheduleList v-if="!editorUI.sidebarCollapsed" />

    <div class="flex flex-row gap-2 p-4 mt-auto">
    </div>
  </nav>
</template>
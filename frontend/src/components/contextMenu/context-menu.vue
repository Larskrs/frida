<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue"
import { useContextMenu } from "./useContextMenu"

const { state, close } = useContextMenu()

function onGlobalClick() {
    close()
}

function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close()
}

onMounted(() => {
    document.addEventListener("click", onGlobalClick)
    window.addEventListener("resize", close)
    document.addEventListener("scroll", close, true)
    document.addEventListener("keydown", onKey)
})

onBeforeUnmount(() => {
    document.removeEventListener("click", onGlobalClick)
    window.removeEventListener("resize", close)
    document.removeEventListener("scroll", close, true)
    document.removeEventListener("keydown", onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
        v-if="state.visible"
        class="editor-context-menu"
        :style="{
        position: 'fixed',
        left: state.x + 'px',
        top: state.y + 'px'
      }"
    >
      <template v-for="(item, i) in state.items" :key="i">

        <hr v-if="item.type === 'separator'" />

        <button
            v-else
            class="menu-item"
            :class="{ danger: item.danger }"
            :disabled="item.disabled"
            @click.stop="
            !item.disabled && item.action?.();
            close();
          "
        >
          {{ item.label }}
        </button>

      </template>
    </div>
  </Teleport>
</template>
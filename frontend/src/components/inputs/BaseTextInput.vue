<script setup lang="ts">
import { ref, watch, nextTick } from "vue"

const props = defineProps<{
  modelValue: string | null | undefined
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const mirror = ref<HTMLSpanElement | null>(null)
const input = ref<HTMLInputElement | null>(null)

function resize() {
  if (!mirror.value || !input.value) return
  mirror.value.textContent = input.value.value || input.value.placeholder || ""
  input.value.style.width = mirror.value.offsetWidth + 1 + "px"
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  emit("update:modelValue", String(target.value))
  resize()
}

watch(() => props.modelValue, () => nextTick(resize), { immediate: true })
</script>

<template>
  <span class="relative inline-flex">
    <span
        ref="mirror"
        class="inputfield invisible min-w-25 absolute whitespace-pre pointer-events-none"
        aria-hidden="true"
    />
    <input
        ref="input"
        class="inputfield min-w-8"
        type="text"
        :value="modelValue ?? ''"
        @input="onInput"
    />
  </span>
</template>
<script setup lang="ts">
defineProps<{
  modelValue: string | null | undefined
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return

  emit("update:modelValue", String(target.value))
}
</script>

<template>
  <input
      class="inputfield"
      type="text"
      :value="modelValue ?? ''"
      @input="onInput"
  />
</template>
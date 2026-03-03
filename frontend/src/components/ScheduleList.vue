<template>
  <div class="w-full flex flex-col">

    <div v-if="status === 'loading'" class="state-view">
      <div class="spinner" />
      <span>Fetching schedules…</span>
    </div>

    <div v-else-if="status === 'error'" class="state-view error">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ errorMessage }}</span>
      <button class="retry-btn" @click="fetch">Retry</button>
    </div>

    <template v-else>
      <ul class="flex flex-col w-full items-start gap-1 p-4">
        <span class="text-xs text-text/75">Kjøreplaner</span>
        <a
           v-for="schedule in schedules"
           :key="schedule.id"
           :href="`/editor?id=${schedule.id}`"
           :class="{ 'bg-muted': schedule.id === scheduleId }"
           class="text-sm px-3 py-1 rounded-md hover:bg-muted w-full">{{ schedule.name }}
        </a>
      </ul>
    </template>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const params = new URLSearchParams(location.search)
const scheduleId = Number(params.get("id") || 1)

interface Row {
  id: number
  order: number
  page: string
  title: string
  duration: number
  cells: Record<string, unknown>
}

interface Column {
  id: number
  name: string
  type: string
  order: number
}

interface Schedule {
  id: number
  name: string
  programStart: number
  rows: Row[]
  columns: Column[]
}

type Status = 'loading' | 'error' | 'success'

const schedules = ref<Schedule[]>([])
const status = ref<Status>('loading')
const errorMessage = ref('')

async function fetch() {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    const res = await window.fetch('/api/schedules')
    if (!res.ok) throw new Error(`Server responded with ${res.status}`)
    schedules.value = await res.json()
    status.value = 'success'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Unknown error occurred'
    status.value = 'error'
  }
}

onMounted(fetch)
</script>
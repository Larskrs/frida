<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60"
        :class="{ 'backdrop-blur-sm': backdrop === 'blur' }"
        @click.self="closeOnBackdrop && close()"
        role="dialog"
        :aria-modal="true"
        :aria-labelledby="titleId"
      >
        <!-- Modal card -->
        <Transition
          enter-active-class="transition-all duration-[250ms] ease-[cubic-bezier(.22,.68,0,1.2)]"
          leave-active-class="transition-all duration-200 ease-in"
          enter-from-class="opacity-0 translate-y-4 scale-[.97]"
          leave-to-class="opacity-0 translate-y-2 scale-[.98]"
        >
          <div
            v-if="isOpen"
            ref="modalRef"
            class="relative flex flex-col w-full bg-white border border-stone-200 rounded-2xl shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden"
            :class="sizeClass"
          >
            <!-- Top accent stripe -->
            <div class="h-[3px] flex-shrink-0" :class="accentClass" />

            <!-- Header -->
            <div
              v-if="$slots.header || title"
              class="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-stone-200 flex-shrink-0"
            >
              <slot name="header">
                <h2
                  :id="titleId"
                  class="m-0 font-serif text-xl font-semibold tracking-tight text-stone-900 leading-snug"
                >
                  {{ title }}
                </h2>
              </slot>
              <button
                v-if="showClose"
                class="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-800 transition-colors"
                @click="close"
                aria-label="Lukk"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 overflow-y-auto flex-1 text-[0.95rem] leading-relaxed text-stone-500">
              <slot :data="modalData" />
            </div>

            <!-- Custom footer slot -->
            <div
              v-if="$slots.footer"
              class="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-shrink-0 flex-wrap"
            >
              <slot name="footer" :close="close" />
            </div>

            <!-- Default footer -->
            <div
              v-else-if="confirmLabel || cancelLabel || action"
              class="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-shrink-0 flex-wrap"
            >
              <!-- Error message -->
              <Transition
                enter-active-class="transition-all duration-200"
                leave-active-class="transition-opacity duration-150"
                enter-from-class="opacity-0 -translate-y-1"
                leave-to-class="opacity-0"
              >
                <span
                  v-if="actionError"
                  class="flex items-center gap-1.5 w-full text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-1"
                  role="alert"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" class="flex-shrink-0">
                    <circle cx="7" cy="7" r="6.25" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  {{ actionError }}
                </span>
              </Transition>

              <!-- Cancel -->
              <button
                v-if="cancelLabel"
                class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-stone-200 text-stone-500 bg-transparent hover:bg-stone-100 hover:text-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.97]"
                :disabled="actionLoading"
                @click="cancel"
              >
                {{ cancelLabel }}
              </button>

              <!-- Confirm (no action fn) -->
              <button
                v-if="confirmLabel && !action"
                class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors active:scale-[.97]"
                :class="confirmBtnClass"
                @click="confirm"
              >
                {{ confirmLabel }}
              </button>

              <!-- Action button -->
              <button
                v-if="action"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed"
                :class="[confirmBtnClass, { 'opacity-80 cursor-not-allowed': actionLoading }]"
                :disabled="actionLoading"
                @click="runAction"
              >
                <svg
                  v-if="actionLoading"
                  class="animate-spin flex-shrink-0"
                  width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="2" stroke-dasharray="26" stroke-dashoffset="10" stroke-linecap="round"/>
                </svg>
                {{ actionLoading ? (actionLoadingLabel || actionLabel || confirmLabel) : (actionLabel || confirmLabel) }}
              </button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useModal } from './composables/useModal'

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  /** v-model – controls open/closed state */
  modelValue: { type: Boolean, default: false },
  /**
   * Optional modal ID — registers this modal with useModal() so it can be
   * opened/closed/populated from anywhere via modals.open(id) etc.
   */
  id: { type: String, default: '' },
  /** Title shown in the header */
  title: { type: String, default: '' },
  /**
   * Size variant
   * @values xs | sm | md | lg | xl | full
   */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['xs', 'sm', 'md', 'lg', 'xl', 'full'].includes(v as string),  },
  /**
   * Visual variant – affects the top accent stripe and confirm button colour
   * @values default | danger | success | info
   */
  variant: {
    type: String,
    default: 'default',
        validator: (v) => ['default', 'danger', 'success', 'info'].includes(v as string),
  },
  /**
   * Backdrop style
   * @values dim | blur | none
   */
  backdrop: {
    type: String,
    default: 'dim',
    validator: (v) => ['dim', 'blur', 'none'].includes(v as string),
  },
  /** Close when clicking outside the modal */
  closeOnBackdrop: { type: Boolean, default: true },
  /** Close when pressing Escape */
  closeOnEsc: { type: Boolean, default: true },
  /** Show the × close button in the header */
  showClose: { type: Boolean, default: true },
  /** Label for the confirm button (renders default footer) */
  confirmLabel: { type: String, default: '' },
  /** Label for the cancel button (renders default footer) */
  cancelLabel: { type: String, default: '' },
  /**
   * Async action called when the action button is clicked.
   * Return true / { ok: true }            → close modal
   * Return false / { ok: false, error? }  → stay open, show error
   * @type {(() => Promise<boolean | { ok: boolean; error?: string }>) | null}
   */
  action: { type: Function, default: null },
  /** Label for the action button. Falls back to confirmLabel. */
  actionLabel: { type: String, default: '' },
  /** Label shown while the action is pending (e.g. "Lagrer…") */
  actionLoadingLabel: { type: String, default: '' },
})

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits(['update:modelValue', 'close', 'confirm', 'cancel'])

// ── Computed classes ─────────────────────────────────────────────────────────
const sizeClass = computed(() => ({
  xs:   'max-w-xs',
  sm:   'max-w-sm',
  md:   'max-w-xl',
  lg:   'max-w-3xl',
  xl:   'max-w-5xl',
  full: 'max-w-full !max-h-screen !rounded-none',
}[props.size]))

const accentClass = computed(() => ({
  default: 'bg-amber-700',
  danger:  'bg-red-600',
  success: 'bg-emerald-500',
  info:    'bg-blue-500',
}[props.variant]))

const confirmBtnClass = computed(() => ({
  default: 'bg-amber-700 hover:bg-amber-800',
  danger:  'bg-red-600 hover:bg-red-700',
  success: 'bg-emerald-500 hover:bg-emerald-600',
  info:    'bg-blue-500 hover:bg-blue-600',
}[props.variant]))

// ── State ────────────────────────────────────────────────────────────────────
const titleId       = computed(() => `frida-modal-title-${Math.random().toString(36).slice(2, 8)}`)
const actionLoading = ref(false)
const actionError   = ref('')

// ── Modal registry integration ───────────────────────────────────────────────
const modals = useModal()

// Single source of truth: registry wins when id is set, otherwise fall back to v-model
const isOpen = computed(() =>
  props.id ? modals.isOpen(props.id) : props.modelValue
)

// Expose data passed via modals.openWithData() to the slot
const modalData = computed(() =>
  props.id ? modals.getData(props.id) : {}
)

// Keep v-model in sync when registry changes (id-driven usage)
watch(isOpen, (val) => {
  if (props.modelValue !== val) emit('update:modelValue', val)
})

// Keep registry in sync when v-model changes (v-model-driven usage)
watch(() => props.modelValue, (val) => {
  if (props.id) modals._setState(props.id, val)
})

// ── Methods ──────────────────────────────────────────────────────────────────
function close () {
  actionError.value   = ''
  actionLoading.value = false
  if (props.id) modals._setState(props.id, false)
  emit('update:modelValue', false)
  emit('close')
}
function confirm () {
  emit('confirm')
  close()
}
function cancel () {
  emit('cancel')
  close()
}

/**
 * Runs the `action` prop, then closes on success or shows an error on failure.
 */
async function runAction () {
  if (!props.action) return
  actionLoading.value = true
  actionError.value   = ''
  try {
    const result = await props.action(modalData.value)
    const ok  = typeof result === 'object' ? result?.ok    : result === true
    const msg = typeof result === 'object' ? result?.error : ''
    if (ok) {
      close()
    } else {
      actionError.value = msg || 'Noe gikk galt. Prøv igjen.'
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'En uventet feil oppstod.'
  } finally {
    actionLoading.value = false
  }
}

// ── Keyboard / scroll-lock ───────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (props.closeOnEsc && e.key === 'Escape' && isOpen.value) close()
}

watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted  (() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>
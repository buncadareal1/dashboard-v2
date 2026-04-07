<template>
  <span
    class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
    :class="negative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'"
  >
    <i :class="negative ? 'pi pi-arrow-down' : 'pi pi-arrow-up'" style="font-size:10px" />
    {{ display }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  value: { type: [Number, String], required: true },
  unit: { type: String, default: '%' },
})
const negative = computed(() => {
  if (typeof props.value === 'number') return props.value < 0
  return String(props.value).startsWith('-')
})
const display = computed(() => {
  if (typeof props.value === 'number') {
    const sign = props.value >= 0 ? '+' : ''
    return `${sign}${props.value}${props.unit}`
  }
  return props.value
})
</script>

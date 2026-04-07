<template>
    <span
        class="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700"
        :class="sizeClass"
        :title="name || ''"
    >
        {{ initial }}
    </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    name: { type: String, default: '' },
    /** Override initial nếu muốn (e.g. employee.initial từ mock). */
    overrideInitial: { type: String, default: null },
    size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
})

const initial = computed(() => {
    if (props.overrideInitial) return props.overrideInitial
    return (props.name || '?').charAt(0).toUpperCase()
})

const sizeClass = computed(() => {
    return {
        sm: 'h-7 w-7 text-[10px]',
        md: 'h-9 w-9 text-xs',
        lg: 'h-12 w-12 text-base',
    }[props.size]
})
</script>

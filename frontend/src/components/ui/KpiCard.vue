<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg" :class="iconBg">
                <span class="material-symbols-outlined text-[20px]" :class="iconColor">{{ icon }}</span>
            </div>
            <span
                v-if="change != null"
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="isNegative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'"
            >
                {{ formattedChange }}
            </span>
        </div>
        <p class="mt-4 text-2xl font-bold text-gray-900">{{ value }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ label }}</p>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    icon: { type: String, default: 'monitoring' },
    iconBg: { type: String, default: 'bg-emerald-50' },
    iconColor: { type: String, default: 'text-emerald-600' },
    change: { type: [Number, String], default: null },
    changeUnit: { type: String, default: '%' },
})

const isNegative = computed(() => {
    if (typeof props.change === 'number') return props.change < 0
    return String(props.change).startsWith('-')
})

const formattedChange = computed(() => {
    if (typeof props.change === 'number') {
        const sign = props.change >= 0 ? '+' : ''
        return `${sign}${props.change}${props.changeUnit}`
    }
    return props.change
})
</script>

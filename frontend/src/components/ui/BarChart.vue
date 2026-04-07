<template>
    <div class="flex items-end gap-3 px-2" :style="{ height: height + 'px' }">
        <div v-for="item in data" :key="item.label" class="flex-1 flex flex-col items-center gap-2">
            <span class="text-[10px] font-semibold text-gray-700">{{ item.value }}{{ valueSuffix }}</span>
            <div
                class="w-full rounded-t-md transition-all"
                :class="barClass"
                :style="{ height: ((item.value / maxValue) * (height - 50)) + 'px' }"
            ></div>
            <span class="text-[10px] text-gray-500">{{ item.label }}</span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    /** Array<{ label: string, value: number }> */
    data: { type: Array, required: true },
    /** Tailwind class cho bar (default emerald). */
    barClass: { type: String, default: 'bg-emerald-100 hover:bg-emerald-200' },
    /** Suffix sau value label (e.g. "B", "M"). */
    valueSuffix: { type: String, default: '' },
    height: { type: Number, default: 192 },
})

const maxValue = computed(() => Math.max(...props.data.map((d) => d.value)))
</script>

<template>
    <span
        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
        :class="badge.class"
    >
        {{ badge.label }}
    </span>
</template>

<script setup>
import { computed } from 'vue'
import { getProjectStatusBadge } from '../../lib/format'

const props = defineProps({
    status: { type: String, required: true },
})

const badge = computed(() => getProjectStatusBadge(props.status))
</script>

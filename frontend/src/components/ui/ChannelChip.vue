<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border"
    :class="badge.class"
  >{{ badge.label }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { getChannelBadge } from '../../lib/format'

const props = defineProps({ channel: { type: String, required: true } })
const badge = computed(() => getChannelBadge(props.channel))
</script>

<template>
  <div
    v-if="show"
    class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium"
    role="status"
  >
    <i class="pi pi-info-circle text-[11px]" />
    <span>Đang dùng dữ liệu mẫu — không kết nối được backend</span>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
})
</script>

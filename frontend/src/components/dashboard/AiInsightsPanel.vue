<template>
  <section class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1">psychology</span>
        <div>
          <h4 class="font-headline font-bold text-sm text-on-surface">Nhận xét AI</h4>
          <p class="text-[10px] text-on-surface-variant">{{ aiProvider === 'rule_based' ? 'Phân tích tự động' : 'Phân tích bởi ' + aiProvider.toUpperCase() }}</p>
        </div>
      </div>
      <button @click="$emit('refresh')" :disabled="aiLoading" class="bg-primary/10 border border-primary/30 text-black px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
        <span class="material-symbols-outlined text-[14px]" :class="{'animate-spin': aiLoading}">{{ aiLoading ? 'sync' : 'auto_awesome' }}</span>
        {{ aiLoading ? 'Đang phân tích...' : 'Phân tích lại' }}
      </button>
    </div>
    <div class="px-8 py-6">
      <div v-if="aiLoading" class="animate-pulse space-y-3">
        <div class="h-4 bg-slate-100 rounded w-full"></div>
        <div class="h-4 bg-slate-100 rounded w-4/5"></div>
        <div class="h-4 bg-slate-100 rounded w-3/5"></div>
      </div>
      <div v-else-if="aiAnalysis" class="text-sm text-on-surface leading-relaxed whitespace-pre-line">{{ aiAnalysis }}</div>
      <p v-else class="text-sm text-on-surface-variant italic">Nhấn "Phân tích lại" để nhận nhận xét từ AI.</p>
      <p v-if="aiError" class="text-xs text-amber-600 mt-3 font-bold">{{ aiError }}</p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  aiAnalysis: { type: String, default: '' },
  aiProvider: { type: String, default: 'rule_based' },
  aiLoading: { type: Boolean, default: false },
  aiError: { type: String, default: '' },
})

defineEmits(['refresh'])
</script>

<template>
  <div class="space-y-4">
    <!-- FINANCIAL KPIs - 6 CARDS -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <!-- Total Spend -->
      <div class="bg-white rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="absolute right-[-10px] bottom-[-10px] opacity-[0.04] pointer-events-none"><span class="material-symbols-outlined text-[80px]">payments</span></div>
        <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 mb-3">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">payments</span>
        </div>
        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">Tổng chi tiêu <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Tổng số tiền đã chi cho quảng cáo trong khoảng thời gian đã chọn">help</span></p>
        <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.totalSpend }}</p>
        <p class="text-[10px] text-on-surface-variant font-bold mt-1">{{ advMetrics.avgDailyBudget }}/ngày</p>
      </div>
      <!-- CPL -->
      <div class="bg-white rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600 mb-3">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">person_pin_circle</span>
        </div>
        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPL <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí trung bình để có được 1 đơn hàng (Cost Per Lead)">help</span></p>
        <p class="text-xl font-headline font-black" :class="parseFloat(advMetrics.cplRaw) > 15 ? 'text-error' : 'text-on-surface'">{{ advMetrics.cpl }}</p>
        <p class="text-[10px] font-bold mt-1" :class="parseFloat(advMetrics.cplRaw) > 15 ? 'text-error' : 'text-primary'">{{ parseFloat(advMetrics.cplRaw) > 15 ? 'Vượt ngưỡng' : 'Đạt mục tiêu' }}</p>
      </div>
      <!-- CPC -->
      <div class="bg-white rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-100 text-violet-600 mb-3">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">ads_click</span>
        </div>
        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPC <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí trung bình cho mỗi lượt click (Cost Per Click)">help</span></p>
        <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.cpc }}</p>
        <p class="text-[10px] text-on-surface-variant font-bold mt-1">Chi phí mỗi click</p>
      </div>
      <!-- CPM -->
      <div class="bg-white rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-cyan-100 text-cyan-600 mb-3">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">visibility</span>
        </div>
        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPM <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí cho mỗi 1,000 lượt hiển thị (Cost Per Mille)">help</span></p>
        <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.cpm }}</p>
        <p class="text-[10px] text-on-surface-variant font-bold mt-1">Mỗi 1K hiển thị</p>
      </div>
      <!-- ROAS -->
      <div class="rounded-xl p-5 hover:-translate-y-1 transition-transform shadow-sm relative overflow-hidden border"
           :class="parseFloat(advMetrics.roas) >= 3 ? 'bg-primary/5 border-primary/20' : 'bg-error/5 border-error/20'">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
             :class="parseFloat(advMetrics.roas) >= 3 ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">trending_up</span>
        </div>
        <p class="text-[9px] uppercase font-black tracking-widest mb-1 flex items-center gap-1" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">ROAS <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Tỷ lệ doanh thu trên chi tiêu quảng cáo (Return On Ad Spend)">help</span></p>
        <p class="text-xl font-headline font-black" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">{{ advMetrics.roas }}x</p>
        <p v-if="parseFloat(advMetrics.roas) >= 100" class="text-[10px] font-bold mt-1 text-amber-600">Giá trị ước tính</p>
        <p v-else class="text-[10px] font-bold mt-1" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">{{ parseFloat(advMetrics.roas) >= 3 ? 'Có lãi' : 'Cần cải thiện' }}</p>
      </div>
      <!-- Frequency -->
      <div class="bg-white rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600 mb-3">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">repeat</span>
        </div>
        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">Tần suất <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Trung bình mỗi người xem quảng cáo bao nhiêu lần">help</span></p>
        <p class="text-xl font-headline font-black" :class="advMetrics.frequency > 3 ? 'text-error' : 'text-on-surface'">{{ advMetrics.frequency }}</p>
        <p class="text-[10px] font-bold mt-1" :class="advMetrics.frequency > 3 ? 'text-error' : 'text-on-surface-variant'">{{ advMetrics.frequency > 3 ? 'Nguy cơ bão hòa' : 'Mức an toàn' }}</p>
      </div>
    </div>

    <!-- KPI GOALS PROGRESS -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="g in kpiGoals" :key="g.label" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{{ g.label }}</span>
          <span class="text-xs font-black" :class="goalReached(g) ? 'text-primary' : 'text-amber-600'">{{ g.current }}{{ g.unit }} / {{ g.target }}{{ g.unit }}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2.5">
          <div class="h-2.5 rounded-full transition-all duration-700" :class="goalReached(g) ? 'bg-primary' : 'bg-amber-500'" :style="`width: ${goalProgress(g)}%`"></div>
        </div>
        <p class="text-[10px] mt-2 font-bold" :class="goalReached(g) ? 'text-primary' : 'text-amber-600'">{{ goalReached(g) ? '✅ Đạt mục tiêu' : '⚠️ Chưa đạt' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  advMetrics: { type: Object, required: true },
  kpiGoals: { type: Array, required: true },
})

const goalProgress = (g) => {
  if (g.inverse) return Math.min((g.target / Math.max(g.current, 1)) * 100, 100)
  return Math.min((g.current / Math.max(g.target, 1)) * 100, 100)
}
const goalReached = (g) => {
  if (g.inverse) return g.current <= g.target
  return g.current >= g.target
}
</script>

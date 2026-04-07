<template>
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
    <!-- Funnel Drop-off Bar Chart -->
    <div class="lg:col-span-3 bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h4 class="text-xl font-headline font-extrabold text-on-surface">Phân tích rơi phễu chuyển đổi</h4>
          <p class="text-xs text-on-surface-variant font-medium mt-1">Xem chính xác bạn mất người dùng ở giai đoạn nào</p>
        </div>
      </div>
      <apexchart type="bar" height="340" :options="funnelChartOptions" :series="funnelChartSeries"></apexchart>
      <!-- Drop rate labels -->
      <div class="flex justify-center gap-3 mt-4 flex-wrap">
        <div v-for="d in dropRates" :key="d.label" class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider"
             :class="d.severity === 'high' ? 'bg-error/10 text-error' : d.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'">
          <span class="material-symbols-outlined text-[16px]">{{ d.severity === 'high' ? 'arrow_downward' : d.severity === 'medium' ? 'remove' : 'arrow_upward' }}</span>
          {{ d.label }}: {{ d.rate }}
        </div>
      </div>
    </div>

    <!-- Conversion Metrics Sidebar -->
    <div class="lg:col-span-2 space-y-4">
      <!-- Conversion Rate Card -->
      <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <h4 class="text-sm font-headline font-bold text-on-surface uppercase tracking-widest mb-4">Tỷ lệ chuyển đổi</h4>
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-bold text-on-surface-variant">Hiển thị → Click (CTR)</span>
              <span class="font-black" :class="parseFloat(advMetrics.ctr) >= 2 ? 'text-primary' : 'text-error'">{{ advMetrics.ctr }}%</span>
            </div>
            <div class="w-full bg-surface-container rounded-full h-2.5">
              <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.ctr) >= 2 ? 'bg-primary' : 'bg-error'" :style="`width: ${Math.min(parseFloat(advMetrics.ctr) * 10, 100)}%`"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-bold text-on-surface-variant">Click → Tương tác</span>
              <span class="font-black" :class="parseFloat(advMetrics.clickToEngRate) >= 50 ? 'text-primary' : 'text-amber-500'">{{ advMetrics.clickToEngRate }}%</span>
            </div>
            <div class="w-full bg-surface-container rounded-full h-2.5">
              <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.clickToEngRate) >= 50 ? 'bg-primary' : 'bg-amber-500'" :style="`width: ${Math.min(parseFloat(advMetrics.clickToEngRate), 100)}%`"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-bold text-on-surface-variant">Click → Mua hàng (CR)</span>
              <span class="font-black" :class="parseFloat(advMetrics.conversionRate) >= 3 ? 'text-primary' : 'text-error'">{{ advMetrics.conversionRate }}%</span>
            </div>
            <div class="w-full bg-surface-container rounded-full h-2.5">
              <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.conversionRate) >= 3 ? 'bg-primary' : 'bg-error'" :style="`width: ${Math.min(parseFloat(advMetrics.conversionRate) * 5, 100)}%`"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-bold text-on-surface-variant">Hiển thị → Mua hàng</span>
              <span class="font-black text-tertiary">{{ advMetrics.purchaseRate }}%</span>
            </div>
            <div class="w-full bg-surface-container rounded-full h-2.5">
              <div class="bg-tertiary h-2.5 rounded-full transition-all duration-700" :style="`width: ${Math.min(parseFloat(advMetrics.purchaseRate) * 20, 100)}%`"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm text-center">
          <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest">Đơn hàng</p>
          <p class="text-3xl font-headline font-black text-primary mt-1">{{ advMetrics.purchases.toLocaleString() }}</p>
        </div>
        <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm text-center">
          <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest">Doanh thu ước tính</p>
          <p class="text-3xl font-headline font-black text-tertiary mt-1">{{ advMetrics.revenueEst }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  advMetrics: { type: Object, required: true },
  funnelChartSeries: { type: Array, required: true },
  funnelChartOptions: { type: Object, required: true },
  dropRates: { type: Array, required: true },
})
</script>

<template>
  <div class="space-y-8 fade-in-animation">

    <!-- Breadcrumb + Back -->
    <div class="flex items-center gap-3">
      <router-link to="/campaigns" class="p-2 hover:bg-slate-100 rounded-lg transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant">arrow_back</span>
      </router-link>
      <div>
        <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Chiến dịch / Chi tiết</p>
        <h2 class="text-2xl font-headline font-black text-on-surface tracking-tight">{{ campaign.name }}</h2>
      </div>
      <span class="ml-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            :class="campaign.status === 'ACTIVE' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-on-surface-variant border border-slate-200'">
        {{ campaign.status === 'ACTIVE' ? 'Đang chạy' : 'Tạm dừng' }}
      </span>
    </div>

    <!-- KPI Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      <div v-for="kpi in kpis" :key="kpi.label" class="bg-surface-container-lowest p-4 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[9px] font-black uppercase tracking-widest" :class="kpi.labelColor">{{ kpi.label }}</p>
        <p class="text-lg font-headline font-black text-on-surface mt-1">{{ kpi.value }}</p>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Spend Trend -->
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-4">Xu hướng chi tiêu 7 ngày</h3>
        <apexchart type="area" height="280" :options="spendChartOptions" :series="spendChartSeries"></apexchart>
      </div>

      <!-- Funnel mini -->
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-4">Phễu chiến dịch</h3>
        <apexchart type="bar" height="280" :options="funnelOptions" :series="funnelSeries"></apexchart>
      </div>

      <!-- Engagement breakdown -->
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-4">Phân bổ tương tác</h3>
        <apexchart type="donut" height="280" :options="engDonutOptions" :series="engDonutSeries"></apexchart>
      </div>

      <!-- Hourly performance -->
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-4">Hiệu quả theo giờ</h3>
        <apexchart type="bar" height="280" :options="hourlyOptions" :series="hourlySeries"></apexchart>
      </div>
    </div>

    <!-- Chi tiết thông tin -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6">Thông tin chiến dịch</h3>
        <div class="space-y-4">
          <div class="flex justify-between py-3 border-b border-slate-100">
            <span class="text-sm text-on-surface-variant font-bold">Tên chiến dịch</span>
            <span class="text-sm font-bold text-on-surface">{{ campaign.name }}</span>
          </div>
          <div class="flex justify-between py-3 border-b border-slate-100">
            <span class="text-sm text-on-surface-variant font-bold">Nguồn dữ liệu</span>
            <span class="text-sm font-mono font-bold text-on-surface">{{ campaign.type }}</span>
          </div>
          <div class="flex justify-between py-3 border-b border-slate-100">
            <span class="text-sm text-on-surface-variant font-bold">Trạng thái</span>
            <span class="text-sm font-bold" :class="campaign.status === 'ACTIVE' ? 'text-primary' : 'text-on-surface-variant'">{{ campaign.status === 'ACTIVE' ? 'Đang chạy' : 'Tạm dừng' }}</span>
          </div>
          <div class="flex justify-between py-3 border-b border-slate-100">
            <span class="text-sm text-on-surface-variant font-bold">Ngân sách hàng ngày</span>
            <span class="text-sm font-bold text-on-surface">{{ Math.round(campaign.spend / 7).toLocaleString() }}</span>
          </div>
          <div class="flex justify-between py-3">
            <span class="text-sm text-on-surface-variant font-bold">Tổng chi tiêu</span>
            <span class="text-sm font-black text-blue-700">{{ campaign.spend.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Đánh giá AI -->
      <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1">psychology</span>
          Đánh giá AI
        </h3>
        <div class="space-y-4">
          <div class="p-4 rounded-xl" :class="campaign.roas >= 3 ? 'bg-primary/5 border border-primary/20' : 'bg-error/5 border border-error/20'">
            <p class="text-sm font-bold" :class="campaign.roas >= 3 ? 'text-primary' : 'text-error'">
              {{ campaign.roas >= 3 ? 'Chiến dịch hiệu quả tốt' : 'Chiến dịch cần tối ưu' }}
            </p>
            <p class="text-xs text-on-surface-variant mt-1">
              ROAS {{ campaign.roas.toFixed(1) }}x — {{ campaign.roas >= 3 ? 'Nên tăng ngân sách để mở rộng.' : 'Xem xét thay đổi đối tượng hoặc nội dung quảng cáo.' }}
            </p>
          </div>
          <div class="p-4 rounded-xl" :class="campaign.ctr >= 2 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'">
            <p class="text-sm font-bold" :class="campaign.ctr >= 2 ? 'text-emerald-700' : 'text-amber-700'">
              CTR: {{ campaign.ctr }}%
            </p>
            <p class="text-xs text-on-surface-variant mt-1">
              {{ campaign.ctr >= 2 ? 'Tỷ lệ click tốt. Nội dung quảng cáo hấp dẫn.' : 'CTR thấp. Cần cải thiện hình ảnh hoặc tiêu đề quảng cáo.' }}
            </p>
          </div>
          <div class="p-4 rounded-xl" :class="campaign.cpl < 15 ? 'bg-primary/5 border border-primary/20' : 'bg-error/5 border border-error/20'">
            <p class="text-sm font-bold" :class="campaign.cpl < 15 ? 'text-primary' : 'text-error'">
              CPL: {{ campaign.cpl.toFixed(2) }}
            </p>
            <p class="text-xs text-on-surface-variant mt-1">
              {{ campaign.cpl < 15 ? 'Chi phí mỗi đơn nằm trong ngưỡng cho phép.' : 'Chi phí mỗi đơn vượt mục tiêu $15. Cân nhắc tạm dừng.' }}
            </p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppDataStore } from '../stores/appData'

const route = useRoute()
const appData = useAppDataStore()

// Tìm campaign theo index từ URL param
const campaignIndex = computed(() => parseInt(route.params.id) || 0)

const campaign = computed(() => {
  const c = appData.topCampaigns[campaignIndex.value] || {}
  const spend = c.spend || 0
  const imp = c.imp || Math.floor(spend * 8.5)
  const clicks = c.clicks || Math.floor(imp * 0.02)
  const eng = c.engagements || Math.floor(imp * 0.05)
  const pur = c.purchases || Math.floor(clicks * 0.03)
  const ctr = imp > 0 ? parseFloat(((clicks / imp) * 100).toFixed(2)) : 0
  const cr = clicks > 0 ? parseFloat(((pur / clicks) * 100).toFixed(2)) : 0
  const cpl = pur > 0 ? spend / pur : 0
  const cpc = clicks > 0 ? spend / clicks : 0
  const cpm = imp > 0 ? (spend / imp) * 1000 : 0
  const roas = spend > 0 ? (pur * 50000000) / spend : 0
  const shares = Math.floor(eng * 0.3)
  const comments = Math.floor(eng * 0.7)

  return {
    name: c.name || 'Chiến dịch chưa đặt tên',
    type: c.source_sheet ? 'TẢI CSV' : 'FACEBOOK API',
    status: c.status || 'ACTIVE',
    spend, impressions: imp, clicks, engagements: eng, purchases: pur,
    shares, comments,
    ctr, cr, cpl, cpc, cpm, roas
  }
})

const kpis = computed(() => {
  const c = campaign.value
  return [
    { label: 'Chi tiêu', value: c.spend.toLocaleString(), labelColor: 'text-blue-600' },
    { label: 'Hiển thị', value: c.impressions.toLocaleString(), labelColor: 'text-on-surface-variant' },
    { label: 'Click', value: c.clicks.toLocaleString(), labelColor: 'text-emerald-600' },
    { label: 'CTR', value: c.ctr + '%', labelColor: 'text-emerald-600' },
    { label: 'Tương tác', value: c.engagements.toLocaleString(), labelColor: 'text-violet-600' },
    { label: 'Đơn hàng', value: c.purchases.toLocaleString(), labelColor: 'text-amber-600' },
    { label: 'CPL', value: c.cpl.toFixed(2), labelColor: c.cpl > 15 ? 'text-error' : 'text-on-surface-variant' },
    { label: 'ROAS', value: c.roas.toFixed(1) + 'x', labelColor: c.roas >= 3 ? 'text-primary' : 'text-error' },
  ]
})

// Spend trend chart (simulate 7 days)
const patterns = [0.12, 0.16, 0.18, 0.14, 0.2, 0.12, 0.08]
const spendChartSeries = computed(() => [{
  name: 'Chi tiêu (đ)',
  data: patterns.map(p => Math.round(campaign.value.spend * p))
}])
const spendChartOptions = {
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  stroke: { curve: 'smooth', width: 3 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
  colors: ['#3b82f6'],
  xaxis: { categories: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] },
  yaxis: { labels: { formatter: v => '' + v.toLocaleString() } },
  dataLabels: { enabled: false }
}

// Mini funnel
const funnelSeries = computed(() => [{
  name: 'Số lượng',
  data: [campaign.value.impressions, campaign.value.clicks, campaign.value.engagements, campaign.value.purchases]
}])
const funnelOptions = {
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
  colors: ['#3b82f6', '#006d33', '#7c3aed', '#f59e0b'],
  xaxis: { categories: ['Hiển thị', 'Click', 'Tương tác', 'Đơn hàng'] },
  yaxis: { labels: { formatter: v => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v } },
  legend: { show: false },
  dataLabels: { enabled: true, formatter: v => v >= 1000 ? (v/1000).toFixed(1) + 'K' : v, style: { fontSize: '11px', fontWeight: 800 } }
}

// Engagement donut
const engDonutSeries = computed(() => [campaign.value.clicks, campaign.value.shares, campaign.value.comments])
const engDonutOptions = {
  chart: { fontFamily: 'inherit' },
  labels: ['Click', 'Chia sẻ', 'Bình luận'],
  colors: ['#006d33', '#06b6d4', '#f59e0b'],
  legend: { position: 'bottom', fontSize: '11px', fontWeight: 700 },
  plotOptions: { pie: { donut: { size: '60%' } } }
}

// Hourly performance
const hourlySeries = computed(() => [{
  name: 'Chuyển đổi',
  data: Array.from({ length: 12 }, (_, i) => {
    const base = campaign.value.purchases / 12
    const mult = [0.3, 0.4, 0.5, 0.8, 1.2, 1.5, 1.8, 1.6, 1.3, 1.0, 0.7, 0.4]
    return Math.round(base * mult[i])
  })
}])
const hourlyOptions = {
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
  colors: ['#006d33'],
  xaxis: { categories: ['6h', '8h', '9h', '10h', '11h', '12h', '14h', '15h', '16h', '18h', '20h', '22h'] },
  dataLabels: { enabled: false }
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

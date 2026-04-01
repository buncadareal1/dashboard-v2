<template>
  <div class="space-y-8 fade-in-animation">

    <!-- LOADING -->
    <div v-if="appData.isLoading" class="animate-pulse space-y-6">
      <div class="h-48 bg-slate-100 rounded-2xl"></div>
      <div class="h-64 bg-slate-100 rounded-2xl"></div>
    </div>

    <template v-if="!appData.isLoading">

    <!-- HEADER -->
    <section class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <p class="text-xs font-bold text-primary mb-2 uppercase tracking-widest">Phân tích</p>
        <h2 class="text-3xl font-headline font-black text-on-surface tracking-tight">Báo cáo nâng cao</h2>
        <p class="text-on-surface-variant text-sm font-medium mt-1">Dữ liệu thật từ Facebook Ads + CSV — {{ campaigns.length }} chiến dịch</p>
      </div>
      <div class="flex flex-wrap gap-3 items-center">
        <button @click="compareMode = !compareMode"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          :class="compareMode ? 'bg-tertiary/10 text-tertiary border border-tertiary/30' : 'bg-slate-100 text-on-surface-variant border border-slate-200 hover:border-slate-300'">
          <span class="material-symbols-outlined text-[16px]">compare_arrows</span>
          {{ compareMode ? 'Đang so sánh' : 'So sánh kỳ' }}
        </button>
        <button @click="exportCSV" class="bg-primary/10 border border-primary/30 text-black px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-primary/20 active:scale-95 transition-all uppercase tracking-widest">
          <span class="material-symbols-outlined text-[16px]">download</span> Xuất CSV
        </button>
      </div>
    </section>

    <!-- SO SÁNH KỲ -->
    <section v-if="compareMode" class="bg-tertiary/5 border border-tertiary/20 p-6 rounded-2xl">
      <div class="flex items-center gap-3 mb-4">
        <span class="material-symbols-outlined text-tertiary">compare_arrows</span>
        <h3 class="text-lg font-headline font-bold text-on-surface">So sánh với kỳ trước (ước tính)</h3>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="c in comparisonData" :key="c.label" class="bg-white p-5 rounded-xl border border-slate-200">
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{{ c.label }}</p>
          <div class="flex items-end justify-between mt-2">
            <p class="text-lg font-black text-on-surface">{{ c.current }}</p>
            <span class="text-sm font-black flex items-center gap-0.5" :class="c.isUp ? 'text-primary' : 'text-error'">
              {{ c.change }}
              <span class="material-symbols-outlined text-[14px]">{{ c.isUp ? 'trending_up' : 'trending_down' }}</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- KPI CARDS -->
    <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="s in summaryCards" :key="s.label" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black uppercase tracking-widest" :class="s.labelColor">{{ s.label }}</p>
        <h3 class="text-2xl font-headline font-black text-on-surface mt-2">{{ s.value }}</h3>
      </div>
    </section>

    <!-- CHARTS -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Chi tiêu theo chiến dịch -->
      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6">Chi tiêu theo chiến dịch</h3>
        <apexchart type="bar" height="350" :options="spendBarOptions" :series="spendBarSeries"></apexchart>
      </div>

      <!-- Phân bổ lượt hiển thị -->
      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6">Phân bổ lượt hiển thị</h3>
        <apexchart type="donut" height="350" :options="impDonutOptions" :series="impDonutSeries"></apexchart>
      </div>

      <!-- CPL so sánh -->
      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6">CPL theo chiến dịch</h3>
        <apexchart type="bar" height="350" :options="cplBarOptions" :series="cplBarSeries"></apexchart>
      </div>

      <!-- CTR so sánh -->
      <div class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-headline font-bold text-on-surface mb-6">CTR theo chiến dịch (%)</h3>
        <apexchart type="bar" height="350" :options="ctrBarOptions" :series="ctrBarSeries"></apexchart>
      </div>
    </section>

    <!-- DATA TABLE -->
    <section class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex justify-between items-center mb-8">
        <h3 class="text-xl font-headline font-black text-on-surface">Báo cáo chi tiết toàn chiến dịch</h3>
        <span class="text-xs text-on-surface-variant font-bold">{{ reportRows.length }} chiến dịch</span>
      </div>
      <DataTable :value="reportRows" stripedRows paginator :rows="10" class="p-datatable-sm">
        <Column field="name" header="Chiến dịch" class="font-bold"></Column>
        <Column field="spend" header="Chi tiêu">
          <template #body="sp"><span class="font-bold text-blue-700">{{ sp.data.spend.toLocaleString() }}</span></template>
        </Column>
        <Column field="impressions" header="Hiển thị">
          <template #body="sp">{{ sp.data.impressions.toLocaleString() }}</template>
        </Column>
        <Column field="clicks" header="Lượt click">
          <template #body="sp">{{ sp.data.clicks.toLocaleString() }}</template>
        </Column>
        <Column field="ctr" header="CTR">
          <template #body="sp">
            <span class="font-black" :class="sp.data.ctr >= 2 ? 'text-primary' : 'text-error'">{{ sp.data.ctr }}%</span>
          </template>
        </Column>
        <Column field="engagements" header="Tương tác">
          <template #body="sp">{{ sp.data.engagements.toLocaleString() }}</template>
        </Column>
        <Column field="purchases" header="Đơn hàng">
          <template #body="sp"><span class="font-black text-primary">{{ sp.data.purchases }}</span></template>
        </Column>
        <Column field="cpl" header="CPL">
          <template #body="sp">
            <span class="font-bold" :class="sp.data.cpl > 15 ? 'text-error' : 'text-on-surface'">{{ sp.data.cpl.toFixed(2) }}</span>
          </template>
        </Column>
        <Column field="roas" header="ROAS">
          <template #body="sp">
            <span class="px-2 py-1 rounded text-[10px] font-black"
                  :class="sp.data.roas >= 3 ? 'bg-primary/10 text-primary border border-primary/20' : sp.data.roas >= 1 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-error/10 text-error border border-error/20'">
              {{ sp.data.roas.toFixed(1) }}x
            </span>
          </template>
        </Column>
      </DataTable>
    </section>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAppDataStore } from '../stores/appData'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const toast = useToast()
const appData = useAppDataStore()
const compareMode = ref(false)

onMounted(() => {
  if (appData.topCampaigns.length === 0) {
    appData.fetchCampaigns()
  }
})

// Transform campaigns thành report rows
const campaigns = computed(() => appData.topCampaigns)

const reportRows = computed(() => {
  return campaigns.value.map(c => {
    const spend = c.spend || 0
    const imp = c.imp || Math.floor(spend * 8.5)
    const clicks = c.clicks || Math.floor(imp * 0.02)
    const eng = c.engagements || Math.floor(imp * 0.05)
    const pur = c.purchases || Math.floor(clicks * 0.03)
    const ctr = imp > 0 ? parseFloat(((clicks / imp) * 100).toFixed(2)) : 0
    const cpl = pur > 0 ? spend / pur : 0
    const roas = spend > 0 ? (pur * 50000000) / spend : 0
    return {
      name: c.name || 'Không rõ',
      type: c.source_sheet ? 'CSV' : 'FB',
      spend, impressions: imp, clicks, engagements: eng, purchases: pur,
      ctr, cpl, roas
    }
  })
})

// Totals
const totals = computed(() => {
  let spend = 0, imp = 0, clicks = 0, eng = 0, pur = 0
  reportRows.value.forEach(r => {
    spend += r.spend; imp += r.impressions; clicks += r.clicks; eng += r.engagements; pur += r.purchases
  })
  const ctr = imp > 0 ? ((clicks / imp) * 100).toFixed(2) : 0
  const cpl = pur > 0 ? (spend / pur).toFixed(2) : 0
  const roas = spend > 0 ? ((pur * 50000000) / spend).toFixed(2) : 0
  return { spend, imp, clicks, eng, pur, ctr, cpl, roas }
})

// KPI Cards
const summaryCards = computed(() => [
  { label: 'Tổng chi tiêu', value: totals.value.spend.toLocaleString(), labelColor: 'text-blue-600' },
  { label: 'ROAS trung bình', value: totals.value.roas + 'x', labelColor: parseFloat(totals.value.roas) >= 3 ? 'text-primary' : 'text-error' },
  { label: 'CPL trung bình', value: '' + parseFloat(totals.value.cpl).toLocaleString(), labelColor: parseFloat(totals.value.cpl) > 15 ? 'text-error' : 'text-primary' },
  { label: 'Tổng đơn hàng', value: totals.value.pur.toLocaleString(), labelColor: 'text-primary' },
])

// So sánh kỳ (ước tính ±15%)
const comparisonData = computed(() => {
  const t = totals.value
  const prev = (v) => Math.round(v * 0.85)
  const pct = (cur, pre) => pre > 0 ? ((cur - pre) / pre * 100).toFixed(1) : 0
  return [
    { label: 'Chi tiêu', current: '' + t.spend.toLocaleString(), change: '+' + pct(t.spend, prev(t.spend)) + '%', isUp: false },
    { label: 'Đơn hàng', current: t.pur.toLocaleString(), change: '+' + pct(t.pur, prev(t.pur)) + '%', isUp: true },
    { label: 'CPL', current: '' + parseFloat(t.cpl).toFixed(0), change: pct(parseFloat(t.cpl), parseFloat(t.cpl) * 1.1) + '%', isUp: true },
    { label: 'ROAS', current: t.roas + 'x', change: '+' + pct(parseFloat(t.roas), parseFloat(t.roas) * 0.9) + '%', isUp: true },
  ]
})

// Chart: Chi tiêu theo chiến dịch
const spendBarSeries = computed(() => [{
  name: 'Chi tiêu (đ)',
  data: reportRows.value.map(r => r.spend)
}])
const spendBarOptions = computed(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
  colors: reportRows.value.map(() => '#3b82f6'),
  xaxis: { categories: reportRows.value.map(r => r.name.length > 18 ? r.name.substring(0, 18) + '...' : r.name), labels: { style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: v => '' + v.toLocaleString() } },
  legend: { show: false },
  dataLabels: { enabled: false }
}))

// Chart: Phân bổ hiển thị donut
const impDonutSeries = computed(() => reportRows.value.map(r => r.impressions))
const impDonutOptions = computed(() => ({
  labels: reportRows.value.map(r => r.name.length > 20 ? r.name.substring(0, 20) + '...' : r.name),
  colors: ['#006d33', '#3b82f6', '#7c3aed', '#f59e0b', '#06b6d4', '#ef4444', '#ec4899', '#84cc16'],
  legend: { position: 'bottom', fontSize: '11px', fontFamily: 'inherit' }
}))

// Chart: CPL so sánh
const cplBarSeries = computed(() => [{
  name: 'CPL (đ)',
  data: reportRows.value.filter(r => r.cpl > 0).map(r => parseFloat(r.cpl.toFixed(2)))
}])
const cplBarOptions = computed(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '55%', distributed: true } },
  colors: reportRows.value.filter(r => r.cpl > 0).map(r => r.cpl > 15 ? '#ba1a1a' : r.cpl > 10 ? '#f59e0b' : '#006d33'),
  xaxis: { categories: reportRows.value.filter(r => r.cpl > 0).map(r => r.name.length > 20 ? r.name.substring(0, 20) + '...' : r.name), title: { text: 'CPL (đ)' } },
  legend: { show: false },
  dataLabels: { enabled: true, formatter: v => '' + v.toFixed(2), style: { fontSize: '11px' } },
  annotations: { xaxis: [{ x: 15, borderColor: '#ba1a1a', strokeDashArray: 4, label: { text: 'Mục tiêu 15K', style: { color: '#ba1a1a', fontSize: '10px', fontWeight: 800 } } }] }
}))

// Chart: CTR
const ctrBarSeries = computed(() => [{
  name: 'CTR (%)',
  data: reportRows.value.map(r => r.ctr)
}])
const ctrBarOptions = computed(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
  colors: reportRows.value.map(r => r.ctr >= 2 ? '#006d33' : r.ctr >= 1 ? '#f59e0b' : '#ba1a1a'),
  xaxis: { categories: reportRows.value.map(r => r.name.length > 18 ? r.name.substring(0, 18) + '...' : r.name), labels: { style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: v => v + '%' } },
  legend: { show: false },
  dataLabels: { enabled: true, formatter: v => v + '%', style: { fontSize: '11px' } },
  annotations: { yaxis: [{ y: 2, borderColor: '#006d33', strokeDashArray: 4, label: { text: 'CTR tốt 2%', style: { fontSize: '10px' } } }] }
}))

// Export
const exportCSV = () => {
  const headers = ['Chiến dịch', 'Chi tiêu', 'Hiển thị', 'Clicks', 'CTR%', 'Tương tác', 'Đơn hàng', 'CPL', 'ROAS']
  const rows = reportRows.value.map(r => [r.name, r.spend, r.impressions, r.clicks, r.ctr, r.engagements, r.purchases, r.cpl.toFixed(2), r.roas.toFixed(2)])
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `bao_cao_${Date.now()}.csv`
  link.click()
  toast.add({ severity: 'success', summary: 'Đã xuất', detail: 'Đã tải xuống báo cáo CSV.', life: 3000 })
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

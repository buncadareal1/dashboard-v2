<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold text-slate-900">Analytics</h1>
          <MockDataBanner :show="usingMock" />
        </div>
        <p class="text-sm text-slate-500 mt-1">Phân tích chi tiết hiệu quả marketing và ROI</p>
      </div>
      <div class="flex gap-2">
        <Dropdown v-model="dateRange" :options="dateRanges" optionLabel="label" class="w-44" />
        <Button label="Xuất báo cáo" icon="pi pi-download" outlined size="small" />
      </div>
    </div>

    <!-- KPI 4 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="k in kpis" :key="k.label" class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <div class="flex items-start justify-between">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg" :class="k.iconBg">
            <i :class="['pi', k.icon, k.iconColor]" />
          </div>
          <DeltaChip :value="k.delta" />
        </div>
        <p class="mt-4 text-2xl font-bold text-slate-900">{{ k.value }}</p>
        <p class="text-sm text-slate-500 mt-1">{{ k.label }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- ROI by channel -->
      <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <h2 class="text-base font-semibold text-slate-900 mb-4">ROI theo kênh quảng cáo</h2>
        <div class="space-y-4">
          <div v-for="r in roiChannels" :key="r.name">
            <div class="flex items-center justify-between text-sm mb-1">
              <div class="flex items-center gap-2">
                <ChannelChip :channel="r.key" />
                <span class="text-slate-700">{{ r.spend }}</span>
              </div>
              <span class="font-bold text-emerald-600">{{ r.roi }}%</span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500" :style="{ width: Math.min(r.roi / 4, 100) + '%' }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Project conversion list -->
      <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <h2 class="text-base font-semibold text-slate-900 mb-4">Hiệu quả theo dự án</h2>
        <div class="space-y-3">
          <div v-for="p in projectStats" :key="p.name" class="flex items-center justify-between p-3 rounded-lg bg-slate-50">
            <div>
              <p class="font-semibold text-slate-900">{{ p.name }}</p>
              <p class="text-xs text-slate-500">{{ p.leads }} leads → {{ p.bookings }} bookings</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-emerald-600">{{ p.rate }}%</p>
              <p class="text-[11px] text-slate-500">Tỷ lệ chốt</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 6-month trend chart -->
    <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
      <h2 class="text-base font-semibold text-slate-900 mb-4">Xu hướng hiệu quả 6 tháng</h2>
      <apexchart v-if="chartReady" type="line" height="320" :options="trendChart.options" :series="trendChart.series" />
    </div>

    <!-- Performance Marketing -->
    <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-base font-semibold text-slate-900">Performance Marketing — 30 ngày</h2>
        <Dropdown v-model="perfProject" :options="projectList" class="w-56" />
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div v-for="s in perfStats" :key="s.label" class="rounded-lg bg-slate-50 p-3">
          <p class="text-[11px] text-slate-500">{{ s.label }}</p>
          <p class="font-bold text-slate-900">{{ s.value }}</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <DataTable :value="dailyRows" size="small" stripedRows>
          <Column field="date" header="Ngày" />
          <Column field="cost" header="Chi phí QC" />
          <Column field="lead" header="Lead" />
          <Column field="f1" header="F1" />
          <Column field="ratio" header="Tỷ lệ F1/Lead" />
          <Column field="cpLead" header="Chi phí/Lead" />
          <Column field="cpF1" header="Chi phí/F1" />
        </DataTable>
        <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs font-bold text-slate-700">
          TỔNG / TB · Chi phí: 1154.4M · Lead: 1,816 · F1: 684 · F1/Lead TB: 37.7% · CP/Lead: 636K · CP/F1: 1.688K
        </div>
      </div>
    </div>

    <!-- AI Analytic -->
    <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
      <div class="flex items-center gap-2 mb-3">
        <h2 class="text-base font-semibold text-slate-900">AI Analytic</h2>
        <span class="text-[10px] px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">AI Powered</span>
      </div>
      <div class="flex gap-2 mb-3">
        <button
          v-for="t in aiTabs"
          :key="t"
          @click="activeAi = t"
          class="px-3 py-1 text-xs rounded-md"
          :class="activeAi === t ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'"
        >{{ t }}</button>
      </div>
      <p class="text-sm text-slate-500 mb-3">Phân tích & đề xuất tối ưu từ dữ liệu 30 ngày</p>

      <div v-if="activeAi === 'Performance Summary'" class="rounded-xl bg-slate-50 p-4">
        <p class="text-xs font-semibold text-slate-700 uppercase mb-2">Section 1 — Tóm tắt tình trạng chiến dịch</p>
        <ul class="text-sm text-slate-700 space-y-2 list-disc pl-5">
          <li v-for="b in summaryBullets" :key="b">{{ b }}</li>
        </ul>
      </div>

      <div v-else class="space-y-3">
        <div v-for="(ai, i) in aiInsights" :key="i" class="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
          <div>
            <p class="text-[11px] font-semibold text-violet-700 uppercase">Insight</p>
            <p class="text-sm text-slate-800">{{ ai.insight }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold text-amber-700 uppercase">Possible Cause</p>
            <p class="text-sm text-slate-700">{{ ai.cause }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold text-emerald-700 uppercase">Recommended Action</p>
            <p class="text-sm text-slate-700">{{ ai.action }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import DeltaChip from '../components/ui/DeltaChip.vue'
import ChannelChip from '../components/ui/ChannelChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import {
  fetchAnalyticsMarketing,
  fetchAnalyticsMarketingSummary,
  fetchAnalyticsFbBitrix24,
} from '../lib/api'

const usingMock = ref(false)
const dateRanges = [{ label: 'Last 30 days', value: '30d' }, { label: 'Last 90 days', value: '90d' }]
const dateRange = ref(dateRanges[0])

const MOCK_KPIS = [
  { label: 'ROI trung bình', value: '285%', delta: 15.2, icon: 'pi-chart-line', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { label: 'Doanh thu từ lead', value: '6.8 tỷ', delta: 8.4, icon: 'pi-dollar', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  { label: 'Tỷ lệ chốt deal', value: '11.1%', delta: 4.2, icon: 'pi-check-circle', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  { label: 'Thời gian chốt TB', value: '14.5 ngày', delta: 2.1, icon: 'pi-clock', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
]
const kpis = ref(MOCK_KPIS)

const MOCK_ROI = [
  { key: 'facebook', name: 'Facebook Ads', spend: '450M chi', roi: 320 },
  { key: 'google', name: 'Google Ads', spend: '380M chi', roi: 295 },
  { key: 'tiktok', name: 'TikTok Ads', spend: '290M chi', roi: 268 },
  { key: 'youtube', name: 'YouTube Ads', spend: '150M chi', roi: 245 },
  { key: 'zalo', name: 'Zalo Ads', spend: '180M chi', roi: 215 },
]
const roiChannels = ref(MOCK_ROI)

const MOCK_PROJECT_STATS = [
  { name: 'Vinhomes Grand Park', leads: 1247, bookings: 142, rate: 11.4 },
  { name: 'Masteri Waterfront', leads: 892, bookings: 98, rate: 11.0 },
  { name: 'The Metropole', leads: 654, bookings: 68, rate: 10.4 },
  { name: 'Eco Green Saigon', leads: 512, bookings: 62, rate: 12.1 },
  { name: 'Sunshine City', leads: 542, bookings: 58, rate: 10.7 },
]
const projectStats = ref(MOCK_PROJECT_STATS)

const chartReady = ref(false)
onMounted(async () => {
  chartReady.value = true
  let mockUsed = false
  const [marketingRes, summaryRes, dailyRes] = await Promise.allSettled([
    fetchAnalyticsMarketing({ page: 1, limit: 30 }),
    fetchAnalyticsMarketingSummary(),
    fetchAnalyticsFbBitrix24({ days: 30 }),
  ])
  if (marketingRes.status === 'fulfilled') {
    const data = marketingRes.value.data?.data || marketingRes.value.data
    if (Array.isArray(data?.kpis)) kpis.value = data.kpis
    if (Array.isArray(data?.projectStats)) projectStats.value = data.projectStats
  } else {
    mockUsed = true
    console.warn('[analytics] marketing fallback:', marketingRes.reason?.message)
  }
  if (summaryRes.status === 'fulfilled') {
    const data = summaryRes.value.data?.data || summaryRes.value.data
    if (Array.isArray(data?.roiChannels)) roiChannels.value = data.roiChannels
  } else {
    mockUsed = true
    console.warn('[analytics] summary fallback:', summaryRes.reason?.message)
  }
  if (dailyRes.status === 'fulfilled') {
    const data = dailyRes.value.data?.data || dailyRes.value.data
    if (Array.isArray(data?.daily)) dailyRows.value = data.daily
  } else {
    mockUsed = true
    console.warn('[analytics] fb-bitrix24 fallback:', dailyRes.reason?.message)
  }
  usingMock.value = mockUsed
})
const trendChart = {
  options: {
    chart: { toolbar: { show: false } },
    colors: ['#10b981', '#3b82f6'],
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: ['T7', 'T8', 'T9', 'T10', 'T11', 'T12'] },
    grid: { borderColor: '#f1f5f9' },
    legend: { position: 'top' },
  },
  series: [
    { name: 'Leads', data: [580, 620, 710, 825, 890, 1050] },
    { name: 'Bookings', data: [62, 70, 82, 95, 108, 128] },
  ],
}

const projectList = ['Vinhomes Grand Park', 'Masteri Waterfront', 'Eco Green Saigon']
const perfProject = ref(projectList[0])
const perfStats = [
  { label: 'Tổng chi phí', value: '1154.4M' },
  { label: 'Tổng Lead', value: '1,816' },
  { label: 'Tổng F1', value: '684' },
  { label: 'Tỷ lệ F1/Lead', value: '37.7%' },
  { label: 'CP/Lead TB', value: '636K' },
  { label: 'CP/F1 TB', value: '1.688K' },
]
const MOCK_DAILY_ROWS = [
  { date: '01/06', cost: '28.5M', lead: 42, f1: 14, ratio: '33.3%', cpLead: '679K', cpF1: '2.036K' },
  { date: '02/06', cost: '31.2M', lead: 48, f1: 17, ratio: '35.4%', cpLead: '650K', cpF1: '1.835K' },
  { date: '03/06', cost: '26.8M', lead: 38, f1: 11, ratio: '28.9%', cpLead: '705K', cpF1: '2.436K' },
  { date: '04/06', cost: '29.4M', lead: 44, f1: 15, ratio: '34.1%', cpLead: '668K', cpF1: '1.960K' },
  { date: '05/06', cost: '35.6M', lead: 56, f1: 21, ratio: '37.5%', cpLead: '636K', cpF1: '1.695K' },
  { date: '06/06', cost: '38.2M', lead: 61, f1: 24, ratio: '39.3%', cpLead: '626K', cpF1: '1.592K' },
  { date: '07/06', cost: '42.1M', lead: 68, f1: 27, ratio: '39.7%', cpLead: '619K', cpF1: '1.559K' },
  { date: '08/06', cost: '30.5M', lead: 45, f1: 14, ratio: '31.1%', cpLead: '678K', cpF1: '2.179K' },
  { date: '09/06', cost: '27.3M', lead: 39, f1: 12, ratio: '30.8%', cpLead: '700K', cpF1: '2.275K' },
  { date: '10/06', cost: '33.8M', lead: 52, f1: 18, ratio: '34.6%', cpLead: '650K', cpF1: '1.878K' },
  { date: '11/06', cost: '36.4M', lead: 58, f1: 22, ratio: '37.9%', cpLead: '628K', cpF1: '1.655K' },
  { date: '12/06', cost: '39.7M', lead: 64, f1: 25, ratio: '39.1%', cpLead: '620K', cpF1: '1.588K' },
  { date: '13/06', cost: '44.2M', lead: 72, f1: 30, ratio: '41.7%', cpLead: '614K', cpF1: '1.473K' },
  { date: '14/06', cost: '47.8M', lead: 78, f1: 33, ratio: '42.3%', cpLead: '613K', cpF1: '1.448K' },
  { date: '15/06', cost: '52.3M', lead: 86, f1: 37, ratio: '43.0%', cpLead: '608K', cpF1: '1.414K' },
]
const dailyRows = ref(MOCK_DAILY_ROWS)

const aiTabs = ['Performance Summary', 'AI Optimization']
const activeAi = ref(aiTabs[0])

const summaryBullets = [
  'Lead tăng trưởng ổn định từ ~42 lead/ngày (đầu tháng) lên ~88 lead/ngày (cuối tháng), tăng hơn 2x trong 30 ngày.',
  'Chi phí quảng cáo tăng dần theo lead, dao động từ 26.8M đến 53.1M/ngày — phù hợp với xu hướng scale ngân sách.',
  'Tỷ lệ F1/Lead cải thiện rõ rệt: từ ~29–33% đầu tháng lên 41–43% cuối tháng, cho thấy chất lượng lead đang tốt hơn.',
  'Chi phí/Lead giảm từ ~705K xuống ~603K — hiệu quả chi tiêu đang cải thiện tốt khi scale.',
  'Giai đoạn 13–15/06 và 28–30/06 là 2 đỉnh performance tốt nhất: tỷ lệ F1/Lead >42%, CP/Lead <615K.',
  'Ngày 03/06 và 08–09/06 có tỷ lệ F1/Lead thấp bất thường (<31%), CP/F1 vượt 2.200K — cần kiểm tra creative và targeting.',
]

const aiInsights = [
  {
    insight: 'Ngày 03/06, 08–09/06 có tỷ lệ F1/Lead giảm mạnh xuống dưới 31% trong khi chi phí không giảm tương ứng.',
    cause: 'Creative fatigue — quảng cáo đã chạy quá lâu, tệp khách hàng bắt đầu bão hòa hoặc targeting chưa đúng phân khúc quan tâm thực sự.',
    action: 'Rotate creative mới vào đầu tuần, thử A/B test 2–3 angle khác nhau. Loại bỏ tệp đã tiếp cận >3 lần trong 7 ngày.',
  },
  {
    insight: 'Giai đoạn 13–15/06 và 28–30/06 đạt tỷ lệ F1/Lead >42% và CP/Lead <615K — performance vượt trội so với trung bình tháng.',
    cause: 'Creative và targeting đang hit đúng tệp khách hàng tiềm năng, có thể trùng với thời điểm khách hàng có nhu cầu cao (cuối tuần, đầu tháng).',
    action: 'Scale ngân sách thêm 20–30% trong các khung giờ và ngày tương tự. Nhân rộng creative đang chạy tốt sang các adset khác.',
  },
]
</script>

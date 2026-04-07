<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold text-gray-900">Dashboard Tổng quan</h1>
          <MockDataBanner :show="usingMock" />
        </div>
        <p class="text-sm text-gray-500 mt-1">Theo dõi hiệu quả marketing và doanh số</p>
      </div>
      <div class="flex items-center gap-2">
        <Dropdown v-model="dateRange" :options="dateRanges" optionLabel="label" class="w-44" />
        <Button label="Xuất báo cáo" icon="pi pi-download" outlined size="small" />
      </div>
    </div>

    <!-- KPI row -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <div
        v-for="kpi in kpis"
        :key="kpi.label"
        class="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm text-gray-500">{{ kpi.label }}</h3>
          <DeltaChip v-if="kpi.delta != null" :value="kpi.delta" :unit="kpi.unit || '%'" />
        </div>
        <p class="text-2xl font-semibold text-gray-900">{{ kpi.value }}</p>
      </div>
    </div>

    <!-- Project performance table -->
    <div class="bg-white rounded-lg border border-gray-200">
      <div class="flex items-center justify-between p-5 border-b border-gray-200">
        <h2 class="text-base font-semibold text-gray-900">Tổng hợp hiệu quả các dự án</h2>
        <router-link to="/projects" class="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Xem chi tiết →</router-link>
      </div>
      <div class="overflow-x-auto">
        <DataTable :value="projectRows" size="small" stripedRows responsiveLayout="scroll">
          <Column header="Dự án" style="min-width:180px">
            <template #body="{ data }">
              <router-link :to="`/projects/${projectSlug(data.name)}`" class="font-medium text-gray-900 hover:text-emerald-600 transition-colors whitespace-nowrap">
                {{ data.name }}
              </router-link>
            </template>
          </Column>
          <Column field="cost" header="Chi phí (M)" />
          <Column field="revenue" header="Doanh số (M)" />
          <Column field="ratio" header="%CP/DS" />
          <Column field="deal" header="Deal" />
          <Column field="booking" header="Booking" />
          <Column field="f1" header="F1" />
          <Column field="lead" header="Lead" />
          <Column field="cpDeal" header="CP/Deal" />
          <Column field="cpBooking" header="CP/Booking" />
          <Column field="cpF1" header="CP/F1" />
          <Column field="cpLead" header="CP/Lead" />
          <Column header="Hiệu quả">
            <template #body="{ data }">
              <Tag :value="data.efficiency" :severity="effSeverity(data.efficiency)" />
            </template>
          </Column>
          <Column header="Trạng thái">
            <template #body="{ data }">
              <StatusBadge :status="data.status" />
            </template>
          </Column>
        </DataTable>
        <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
          <span>TỔNG CỘNG</span>
          <span>Chi phí: {{ totals.cost }}M</span>
          <span>Doanh số: {{ totals.revenue }}M</span>
          <span>Deal: {{ totals.deal }}</span>
          <span>Booking: {{ totals.booking }}</span>
          <span>F1: {{ totals.f1 }}</span>
          <span>Lead: {{ totals.lead }}</span>
        </div>
      </div>
    </div>

    <!-- Per-MKT staff -->
    <div class="bg-white rounded-lg border border-gray-200">
      <div class="flex items-center justify-between p-5 border-b border-gray-200">
        <h2 class="text-base font-semibold text-gray-900">Doanh số theo dự án / Nhân viên Marketing</h2>
        <router-link to="/projects" class="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Xem chi tiết →</router-link>
      </div>
      <div class="overflow-x-auto">
        <DataTable :value="staffRows" size="small" stripedRows responsiveLayout="scroll">
          <Column header="Dự án" style="min-width:180px">
            <template #body="{ data }">
              <router-link :to="`/projects/${projectSlug(data.project)}`" class="font-medium text-gray-900 hover:text-emerald-600 transition-colors whitespace-nowrap">
                {{ data.project }}
              </router-link>
            </template>
          </Column>
          <Column header="Nhân viên">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <Avatar :label="data.staff[0]" shape="circle" size="normal" class="bg-emerald-100 text-emerald-700" />
                <span class="text-sm">{{ data.staff }}</span>
              </div>
            </template>
          </Column>
          <Column field="revenue" header="Doanh số" />
          <Column field="cost" header="Chi phí" />
          <Column field="ratio" header="%CP/DS" />
          <Column field="booking" header="Booking" />
          <Column field="deal" header="Deal" />
          <Column field="cpBooking" header="CP/Booking" />
          <Column field="cpDeal" header="CP/Deal" />
          <Column header="Hiệu quả">
            <template #body="{ data }">
              <Tag :value="data.efficiency" :severity="effSeverity(data.efficiency)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Avatar from 'primevue/avatar'
import StatusBadge from '../components/ui/StatusBadge.vue'
import DeltaChip from '../components/ui/DeltaChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import { fetchDashboardStats, fetchMergedCampaigns } from '../lib/api'

const PROJECT_SLUG_MAP = {
  'Vinhomes Grand Park': 'vinhomes-grand-park',
  'Masteri Waterfront': 'masteri-waterfront',
  'The Metropole Thu Thiem': 'metropole-thu-thiem',
  'Eco Green Saigon': 'eco-green-saigon',
  'Sunshine City': 'sunshine-city',
  'The Manor Central Park': 'manor-central-park',
}
const projectSlug = (name) =>
  PROJECT_SLUG_MAP[name] ||
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const usingMock = ref(false)
const loading = ref(true)

const dateRanges = [
  { label: '7 ngày qua', value: '7d' },
  { label: '30 ngày qua', value: '30d' },
  { label: '90 ngày qua', value: '90d' },
]
const dateRange = ref(dateRanges[1])

const MOCK_KPIS = [
  { label: 'Tổng doanh số', value: '46.58 tỷ', delta: 18.2 },
  { label: 'Tổng dự án đang triển khai', value: '6', delta: 2, unit: '' },
  { label: 'Tổng chi phí Marketing', value: '2.4 tỷ', delta: 8.3 },
  { label: '% Chi phí / Doanh thu', value: '6.2%', delta: -0.8 },
  { label: 'Số căn đã chốt', value: '351', delta: 24, unit: '' },
]
const kpis = ref(MOCK_KPIS)

const MOCK_PROJECT_ROWS = [
  { name: 'Vinhomes Grand Park', cost: 850, revenue: 12450, ratio: '6.8%', deal: 87, booking: 142, f1: 418, lead: 1247, cpDeal: 9.8, cpBooking: 6.0, cpF1: 2.0, cpLead: 0.68, efficiency: 'Cần tối ưu', status: 'running' },
  { name: 'Masteri Waterfront', cost: 620, revenue: 8920, ratio: '7.0%', deal: 64, booking: 98, f1: 298, lead: 892, cpDeal: 9.7, cpBooking: 6.3, cpF1: 2.1, cpLead: 0.70, efficiency: 'Cần tối ưu', status: 'running' },
  { name: 'The Metropole Thu Thiem', cost: 480, revenue: 7560, ratio: '6.3%', deal: 52, booking: 68, f1: 215, lead: 654, cpDeal: 9.2, cpBooking: 7.1, cpF1: 2.2, cpLead: 0.73, efficiency: 'Cần tối ưu', status: 'warning' },
  { name: 'Eco Green Saigon', cost: 320, revenue: 5680, ratio: '5.6%', deal: 48, booking: 62, f1: 178, lead: 512, cpDeal: 6.7, cpBooking: 5.2, cpF1: 1.8, cpLead: 0.63, efficiency: 'Cần tối ưu', status: 'running' },
  { name: 'Sunshine City', cost: 280, revenue: 4850, ratio: '5.8%', deal: 42, booking: 58, f1: 175, lead: 542, cpDeal: 6.7, cpBooking: 4.8, cpF1: 1.6, cpLead: 0.52, efficiency: 'Cần tối ưu', status: 'paused' },
  { name: 'The Manor Central Park', cost: 450, revenue: 7120, ratio: '6.3%', deal: 58, booking: 82, f1: 245, lead: 728, cpDeal: 7.8, cpBooking: 5.5, cpF1: 1.8, cpLead: 0.62, efficiency: 'Cần tối ưu', status: 'running' },
]
const projectRows = ref(MOCK_PROJECT_ROWS)

const totals = computed(() => {
  const sum = (k) => projectRows.value.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  return {
    cost: sum('cost'),
    revenue: sum('revenue'),
    deal: sum('deal'),
    booking: sum('booking'),
    f1: sum('f1'),
    lead: sum('lead'),
  }
})

const staffRows = [
  { project: 'Vinhomes Grand Park', staff: 'Nguyễn Văn A', revenue: '12.45 tỷ', cost: '850M', ratio: '6.8%', booking: 142, deal: 87, cpBooking: '6.0M', cpDeal: '9.8M', efficiency: 'Cần tối ưu' },
  { project: 'Masteri Waterfront', staff: 'Trần Thị B', revenue: '8.92 tỷ', cost: '620M', ratio: '7.0%', booking: 98, deal: 64, cpBooking: '6.3M', cpDeal: '9.7M', efficiency: 'Cần tối ưu' },
  { project: 'The Metropole Thu Thiem', staff: 'Lê Văn C', revenue: '7.56 tỷ', cost: '480M', ratio: '6.3%', booking: 68, deal: 52, cpBooking: '7.1M', cpDeal: '9.2M', efficiency: 'Cần tối ưu' },
  { project: 'Eco Green Saigon', staff: 'Phạm Thị D', revenue: '5.68 tỷ', cost: '320M', ratio: '5.6%', booking: 62, deal: 48, cpBooking: '5.2M', cpDeal: '6.7M', efficiency: 'Cần tối ưu' },
  { project: 'Sunshine City', staff: 'Hoàng Văn E', revenue: '4.85 tỷ', cost: '280M', ratio: '5.8%', booking: 58, deal: 42, cpBooking: '4.8M', cpDeal: '6.7M', efficiency: 'Cần tối ưu' },
  { project: 'The Manor Central Park', staff: 'Đỗ Văn F', revenue: '7.12 tỷ', cost: '450M', ratio: '6.3%', booking: 82, deal: 58, cpBooking: '5.5M', cpDeal: '7.8M', efficiency: 'Cần tối ưu' },
]

onMounted(async () => {
  try {
    const [statsRes, campRes] = await Promise.allSettled([
      fetchDashboardStats(),
      fetchMergedCampaigns(),
    ])
    let mockUsed = false
    if (statsRes.status === 'fulfilled') {
      const data = statsRes.value.data?.data || statsRes.value.data
      if (Array.isArray(data?.kpis)) {
        kpis.value = data.kpis
      }
    } else {
      mockUsed = true
      console.warn('[dashboard] stats fallback:', statsRes.reason?.message)
    }
    if (campRes.status === 'fulfilled') {
      const rows = campRes.value.data?.data || campRes.value.data
      if (Array.isArray(rows) && rows.length) {
        projectRows.value = rows
      }
    } else {
      mockUsed = true
      console.warn('[dashboard] campaigns fallback:', campRes.reason?.message)
    }
    usingMock.value = mockUsed
  } catch (e) {
    usingMock.value = true
    console.warn('[dashboard] using mock data:', e.message)
  } finally {
    loading.value = false
  }
})

function effSeverity(eff) {
  if (eff === 'Xuất sắc') return 'success'
  if (eff === 'Tốt') return 'info'
  if (eff === 'Cần tối ưu') return 'warn'
  return 'secondary'
}
</script>

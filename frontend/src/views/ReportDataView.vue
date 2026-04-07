<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold text-slate-900">Report Data — CRM</h1>
          <MockDataBanner :show="usingMock" />
        </div>
        <p class="text-sm text-slate-500 mt-1">Quản lý toàn bộ data lead từ các kênh quảng cáo</p>
      </div>
      <div class="flex gap-2">
        <Button label="Kết nối nguồn" icon="pi pi-link" outlined size="small" />
        <Button label="Thêm lead thủ công" icon="pi pi-plus" severity="success" size="small" />
      </div>
    </div>

    <!-- KPI 5 -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <div v-for="k in kpis" :key="k.label" class="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <p class="text-sm text-slate-500">{{ k.label }}</p>
        <p class="text-2xl font-bold text-slate-900 mt-2">{{ k.value }}</p>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
      <span class="text-sm font-semibold text-slate-700">Lọc:</span>
      <Dropdown v-model="filters.time" :options="timeOpts" placeholder="Thời gian" class="w-36" />
      <Dropdown v-model="filters.project" :options="projectOpts" placeholder="Dự án" class="w-44" />
      <Dropdown v-model="filters.fanpage" :options="fanpageOpts" placeholder="Fanpage" class="w-44" />
      <Dropdown v-model="filters.source" :options="sourceOpts" placeholder="Nguồn" class="w-32" />
      <Dropdown v-model="filters.status" :options="statusOpts" placeholder="Tình trạng" class="w-36" />
      <span class="ml-auto text-sm text-slate-500">Tổng: <b>{{ leads.length }}</b> bản ghi</span>
    </div>

    <!-- Leads table -->
    <div class="bg-white rounded-lg border border-slate-100 shadow-sm overflow-x-auto">
      <DataTable :value="leads" size="small" stripedRows scrollable scrollHeight="600px">
        <Column field="createdTime" header="Created Time" style="min-width:140px" />
        <Column header="Full Name" style="min-width:180px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <Avatar :label="data.fullName[0]" shape="circle" size="normal" class="bg-emerald-100 text-emerald-700" />
              <span class="text-sm">{{ data.fullName }}</span>
            </div>
          </template>
        </Column>
        <Column field="email" header="Email" style="min-width:200px" />
        <Column header="Tình trạng">
          <template #body="{ data }">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="statusClass(data.status)">{{ data.status }}</span>
          </template>
        </Column>
        <Column field="project" header="Dự án" style="min-width:180px" />
        <Column field="fanpage" header="Fanpage" />
        <Column field="campaign" header="Campaign" />
        <Column field="adset" header="Adset" />
        <Column field="ad" header="Ad" />
        <Column field="formName" header="Form Name" />
        <Column field="leadId" header="Lead ID" />
        <Column header="Nguồn">
          <template #body="{ data }"><ChannelChip :channel="data.source" /></template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Avatar from 'primevue/avatar'
import ChannelChip from '../components/ui/ChannelChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import { fetchLeads } from '../lib/api'

const usingMock = ref(false)

const MOCK_LEADS_INLINE = [
  { createdTime: '2025-01-15 08:32:14', fullName: 'Nguyễn Văn An', email: 'nguyenvanan@gmail.com', status: 'F1', project: 'Vinhomes Grand Park', fanpage: 'Vinhomes Grand Park Official', campaign: 'Vinhomes Grand Park - Q4 2024', adset: 'Adset - Nam 28-45 HCM', ad: 'Video Tour 360° - Căn hộ mẫu 2PN', formName: 'Form Lead VGP Tháng 1', leadId: 'FB_1234567890', source: 'facebook' },
  { createdTime: '2025-01-15 09:14:22', fullName: 'Trần Thị Bình', email: 'tranthib@gmail.com', status: 'Booking', project: 'Vinhomes Grand Park', fanpage: 'VGP Bất Động Sản HCM', campaign: 'Vinhomes Grand Park - Q4 2024', adset: 'Adset - Nữ 30-50 HCM', ad: 'Carousel - Tiện ích nội khu', formName: 'Form Lead VGP Tháng 1', leadId: 'FB_1234567891', source: 'facebook' },
  { createdTime: '2025-01-15 10:05:47', fullName: 'Lê Văn Cường', email: 'levanc@gmail.com', status: 'Đang chăm', project: 'Masteri Waterfront', fanpage: 'Masteri Waterfront TikTok', campaign: 'Masteri Waterfront - TikTok Campaign', adset: 'Adset - Lookalike 1%', ad: 'Video Lifestyle - Masteri', formName: 'Form TikTok Masteri', leadId: 'TT_9876543210', source: 'tiktok' },
  { createdTime: '2025-01-15 10:48:33', fullName: 'Phạm Thị Dung', email: 'phamthid@gmail.com', status: 'Deal', project: 'Vinhomes Grand Park', fanpage: 'Google Search VGP', campaign: 'Vinhomes Grand Park - Search Ads', adset: 'Search - Brand Keywords', ad: 'Search - Từ khóa thương hiệu', formName: 'Form Google VGP', leadId: 'GG_1122334455', source: 'google' },
  { createdTime: '2025-01-15 11:22:09', fullName: 'Hoàng Văn Em', email: 'hoangvane@gmail.com', status: 'F1', project: 'Masteri Waterfront', fanpage: 'Masteri Waterfront Official', campaign: 'Masteri Waterfront - Facebook Retargeting', adset: 'Retargeting - Website Visitors', ad: 'Retargeting - Khách đã xem website', formName: 'Form Retargeting Masteri', leadId: 'FB_2233445566', source: 'facebook' },
  { createdTime: '2025-01-15 13:10:55', fullName: 'Đỗ Văn Phúc', email: 'dovanphuc@gmail.com', status: 'Booking', project: 'The Metropole Thu Thiem', fanpage: 'Google Display Metropole', campaign: 'The Metropole - Google Display', adset: 'Display - Remarketing', ad: 'Banner - The Metropole Premium', formName: 'Form Display Metropole', leadId: 'GG_3344556677', source: 'google' },
  { createdTime: '2025-01-15 14:05:18', fullName: 'Vũ Thị Giang', email: 'vuthig@gmail.com', status: 'Đang chăm', project: 'Eco Green Saigon', fanpage: 'Eco Green Saigon Fanpage', campaign: 'Eco Green - Facebook Lead Ads', adset: 'Adset - Interest Eco Living', ad: 'Lead Form - Nhận báo giá ngay', formName: 'Form Lead Eco Green', leadId: 'FB_4455667788', source: 'facebook' },
  { createdTime: '2025-01-15 14:52:41', fullName: 'Bùi Văn Hải', email: 'buivanh@gmail.com', status: 'F1', project: 'The Metropole Thu Thiem', fanpage: 'The Metropole YouTube', campaign: 'The Metropole - YouTube Ads', adset: 'YouTube - In-stream Ads', ad: 'Video Brand - The Metropole', formName: 'Form YouTube Metropole', leadId: 'YT_5566778899', source: 'youtube' },
  { createdTime: '2025-01-15 15:30:27', fullName: 'Ngô Thị Lan', email: 'ngothilan@gmail.com', status: 'Deal', project: 'Vinhomes Grand Park', fanpage: 'Vinhomes Grand Park Official', campaign: 'Vinhomes Grand Park - Q4 2024', adset: 'Adset - Nam 28-45 HCM', ad: 'Lead Form - Nhận báo giá ngay', formName: 'Form Lead VGP Tháng 1', leadId: 'FB_6677889900', source: 'facebook' },
  { createdTime: '2025-01-15 16:14:03', fullName: 'Đinh Văn Minh', email: 'dinhvanm@gmail.com', status: 'Đang chăm', project: 'Sunshine City', fanpage: 'Sunshine City Zalo OA', campaign: 'Sunshine City - Zalo Ads', adset: 'Zalo - Targeting HCM', ad: 'Banner Zalo - Sunshine City', formName: 'Form Zalo Sunshine', leadId: 'ZL_7788990011', source: 'zalo' },
  { createdTime: '2025-01-16 08:05:12', fullName: 'Trương Văn Nam', email: 'truongvann@gmail.com', status: 'F1', project: 'Masteri Waterfront', fanpage: 'Masteri Waterfront TikTok', campaign: 'Masteri Waterfront - TikTok Campaign', adset: 'Adset - Lookalike 2%', ad: 'Video Lifestyle - Masteri', formName: 'Form TikTok Masteri', leadId: 'TT_8899001122', source: 'tiktok' },
  { createdTime: '2025-01-16 09:22:44', fullName: 'Lý Thị Oanh', email: 'lythio@gmail.com', status: 'Booking', project: 'Eco Green Saigon', fanpage: 'Eco Green Saigon Fanpage 2', campaign: 'Eco Green - Facebook Lead Ads', adset: 'Adset - Interest Green Living', ad: 'Carousel - Tiện ích Eco Green', formName: 'Form Lead Eco Green', leadId: 'FB_9900112233', source: 'facebook' },
  { createdTime: '2025-01-16 10:45:30', fullName: 'Phan Văn Quang', email: 'phanvanq@gmail.com', status: 'Đang chăm', project: 'Vinhomes Grand Park', fanpage: 'Google Search VGP', campaign: 'Vinhomes Grand Park - Search Ads', adset: 'Search - Competitor Keywords', ad: 'Search - Từ khóa cạnh tranh', formName: 'Form Google VGP', leadId: 'GG_0011223344', source: 'google' },
  { createdTime: '2025-01-16 11:18:55', fullName: 'Hồ Thị Rạng', email: 'hothir@gmail.com', status: 'F1', project: 'The Metropole Thu Thiem', fanpage: 'The Metropole Google Display', campaign: 'The Metropole - Google Display', adset: 'Display - Interest Luxury', ad: 'Banner - The Metropole Premium', formName: 'Form Display Metropole', leadId: 'GG_1122334456', source: 'google' },
  { createdTime: '2025-01-16 13:40:08', fullName: 'Tô Văn Sơn', email: 'tovans@gmail.com', status: 'Deal', project: 'Masteri Waterfront', fanpage: 'Masteri Waterfront Official', campaign: 'Masteri Waterfront - Facebook Retargeting', adset: 'Retargeting - Cart Abandoners', ad: 'Retargeting - Khách đã xem website', formName: 'Form Retargeting Masteri', leadId: 'FB_2233445567', source: 'facebook' },
]
const leads = ref(MOCK_LEADS_INLINE)

const kpis = computed(() => [
  { label: 'Tổng lead', value: leads.value.length },
  { label: 'F1', value: leads.value.filter(l => l.status === 'F1').length },
  { label: 'Đang chăm', value: leads.value.filter(l => l.status === 'Đang chăm').length },
  { label: 'Booking', value: leads.value.filter(l => l.status === 'Booking').length },
  { label: 'Deal', value: leads.value.filter(l => l.status === 'Deal').length },
])

const timeOpts = ['Hôm nay', '7 ngày', '30 ngày']
const projectOpts = ['Vinhomes Grand Park', 'Masteri Waterfront', 'Eco Green Saigon']
const fanpageOpts = ['Vinhomes Official', 'Masteri Page']
const sourceOpts = ['Facebook', 'Google', 'TikTok', 'Zalo']
const statusOpts = ['F1', 'Đang chăm', 'Booking', 'Deal']
const filters = ref({ time: null, project: null, fanpage: null, source: null, status: null })

async function reload() {
  try {
    const params = { page: 1, limit: 50 }
    if (filters.value.project) params.project = filters.value.project
    if (filters.value.source) params.source = filters.value.source
    if (filters.value.status) params.status = filters.value.status
    const { data } = await fetchLeads(params)
    const rows = data?.data || data?.items || data
    if (Array.isArray(rows) && rows.length) {
      leads.value = rows
      usingMock.value = false
    } else {
      usingMock.value = true
    }
  } catch (e) {
    usingMock.value = true
    console.warn('[leads] using mock data:', e.message)
  }
}

onMounted(reload)

function statusClass(s) {
  return {
    'F1': 'bg-blue-50 text-blue-700',
    'Đang chăm': 'bg-amber-50 text-amber-700',
    'Booking': 'bg-violet-50 text-violet-700',
    'Deal': 'bg-emerald-50 text-emerald-700',
  }[s] || 'bg-slate-100 text-slate-700'
}
</script>

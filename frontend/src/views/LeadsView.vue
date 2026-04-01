<template>
  <div class="space-y-8 fade-in-animation">
    <div v-if="loading" class="animate-pulse space-y-6">
      <div class="h-48 bg-slate-100 rounded-2xl"></div>
      <div class="h-64 bg-slate-100 rounded-2xl"></div>
    </div>

    <template v-if="!loading">

    <!-- HEADER -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <p class="font-black text-primary text-xs uppercase tracking-[0.3em] mb-1">Facebook Ads → Bitrix24</p>
        <h2 class="text-3xl font-headline font-black text-on-surface tracking-tight">Khách hàng từ quảng cáo</h2>
        <div class="flex items-center gap-2 mt-2">
          <span class="w-2 h-2 rounded-full" :class="dataSource === 'bitrix24' ? 'bg-primary' : 'bg-amber-500'"></span>
          <span class="text-xs font-bold text-on-surface-variant">{{ dataSource === 'bitrix24' ? 'Bitrix24 CRM' : 'Chưa kết nối Bitrix24' }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button @click="refreshData" class="bg-slate-100 border border-slate-300 text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-200 transition-all">
          <span class="material-symbols-outlined text-[16px]" :class="{'animate-spin': refreshing}">sync</span> Làm mới
        </button>
        <button @click="exportCSV" class="bg-primary/10 border border-primary/30 text-black px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-primary/20 active:scale-95 transition-all uppercase tracking-widest">
          <span class="material-symbols-outlined text-[16px]">download</span> Xuất CSV
        </button>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Tổng lead</p>
        <p class="text-2xl font-headline font-black text-on-surface mt-1">{{ leads.length }}</p>
      </div>
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black text-blue-600 uppercase tracking-widest">Mới</p>
        <p class="text-2xl font-headline font-black text-blue-600 mt-1">{{ countByStatus('MỚI') }}</p>
      </div>
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black text-amber-600 uppercase tracking-widest">Đang tư vấn</p>
        <p class="text-2xl font-headline font-black text-amber-600 mt-1">{{ countByStatus('ĐANG TƯ VẤN') }}</p>
      </div>
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black text-primary uppercase tracking-widest">Chốt đơn</p>
        <p class="text-2xl font-headline font-black text-primary mt-1">{{ countByStatus('CHỐT ĐƠN') }}</p>
      </div>
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-black text-error uppercase tracking-widest">Thất bại</p>
        <p class="text-2xl font-headline font-black text-error mt-1">{{ countByStatus('THẤT BẠI') }}</p>
      </div>
    </div>

    <!-- CAMPAIGN SUMMARY -->
    <div v-if="campaignSummary.length > 0" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-8 py-5 border-b border-slate-200 bg-slate-50">
        <h3 class="font-headline font-black text-lg text-on-surface">Thống kê theo chiến dịch / dự án</h3>
        <p class="text-xs text-on-surface-variant mt-1">Map dữ liệu Facebook Ads ↔ Bitrix24</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[700px]">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Chiến dịch / Dự án</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Tổng</th>
              <th class="px-4 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Mới</th>
              <th class="px-4 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">Tư vấn</th>
              <th class="px-4 py-4 text-[10px] font-black text-primary uppercase tracking-widest text-center">Chốt đơn</th>
              <th class="px-4 py-4 text-[10px] font-black text-error uppercase tracking-widest text-center">Thất bại</th>
              <th class="px-4 py-4 text-[10px] font-black text-primary uppercase tracking-widest text-center">Tỷ lệ chốt</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="c in campaignSummary" :key="c.campaign" class="hover:bg-primary/5 transition-colors cursor-pointer" @click="campaignFilter = campaignFilter === c.campaign ? 'all' : c.campaign">
              <td class="px-6 py-4">
                <p class="font-bold text-sm text-on-surface" :class="{'text-primary': campaignFilter === c.campaign}">{{ c.campaign }}</p>
              </td>
              <td class="px-4 py-4 text-center font-black text-on-surface">{{ c.total }}</td>
              <td class="px-4 py-4 text-center font-bold text-blue-600">{{ c.moi || 0 }}</td>
              <td class="px-4 py-4 text-center font-bold text-amber-600">{{ c.dang_tu_van || 0 }}</td>
              <td class="px-4 py-4 text-center font-bold text-primary">{{ c.chot_don || 0 }}</td>
              <td class="px-4 py-4 text-center font-bold text-error">{{ c.that_bai || 0 }}</td>
              <td class="px-4 py-4 text-center">
                <span class="px-2 py-1 rounded text-[11px] font-black"
                      :class="c.close_rate >= 30 ? 'bg-primary/10 text-primary' : c.close_rate >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-error/10 text-error'">
                  {{ c.close_rate }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="flex flex-wrap gap-4">
      <div class="relative flex-1 min-w-[200px] max-w-md">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input v-model="search" type="text" placeholder="Tìm theo tên..." class="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
      </div>
      <select v-model="statusFilter" class="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
        <option value="all">Tất cả trạng thái</option>
        <option value="MỚI">Mới</option>
        <option value="ĐANG TƯ VẤN">Đang tư vấn</option>
        <option value="CHỐT ĐƠN">Chốt đơn</option>
        <option value="THẤT BẠI">Thất bại</option>
      </select>
      <select v-model="leadTypeFilter" class="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
        <option value="all">Tất cả loại lead</option>
        <option value="MKT mới">MKT mới</option>
        <option value="MKT cũ">MKT cũ</option>
        <option value="Data Công ty">Data Công ty</option>
      </select>
      <select v-model="campaignFilter" class="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
        <option value="all">Tất cả chiến dịch</option>
        <option v-for="c in campaignSummary" :key="c.campaign" :value="c.campaign">{{ c.campaign }}</option>
      </select>
    </div>

    <!-- LEADS TABLE -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-8 py-4 border-b border-slate-200 flex justify-between items-center">
        <span class="text-xs font-bold text-on-surface-variant">{{ filteredLeads.length }} khách hàng</span>
        <span v-if="campaignFilter !== 'all'" @click="campaignFilter = 'all'" class="text-xs text-primary font-bold cursor-pointer hover:underline">Bỏ lọc chiến dịch ✕</span>
      </div>
      <DataTable :value="filteredLeads" paginator :rows="15" stripedRows class="p-datatable-sm">
        <Column field="id" header="ID" style="width: 80px"></Column>
        <Column field="created_at" header="Ngày tạo">
          <template #body="sp">
            <span class="text-xs">{{ formatDate(sp.data.created_at) }}</span>
          </template>
        </Column>
        <Column field="name" header="Tên khách hàng">
          <template #body="sp">
            <span class="font-bold text-on-surface">{{ sp.data.name }}</span>
          </template>
        </Column>
        <Column field="campaign" header="Chiến dịch / Dự án">
          <template #body="sp">
            <span class="text-xs font-bold text-on-surface-variant">{{ sp.data.campaign }}</span>
          </template>
        </Column>
        <Column field="lead_type" header="Loại lead">
          <template #body="sp">
            <span v-if="sp.data.lead_type" class="text-xs font-bold px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-on-surface-variant">{{ sp.data.lead_type }}</span>
            <span v-else class="text-xs text-on-surface-variant">—</span>
          </template>
        </Column>
        <Column field="old_status" header="Chi tiết">
          <template #body="sp">
            <span v-if="sp.data.old_status" class="text-xs text-on-surface-variant">{{ sp.data.old_status }}</span>
            <span v-else class="text-xs text-on-surface-variant">—</span>
          </template>
        </Column>
        <Column header="Trạng thái">
          <template #body="sp">
            <span :class="getStatusClass(sp.data.status)">{{ sp.data.status }}</span>
          </template>
        </Column>
        <Column field="resp_person" header="Phụ trách">
          <template #body="sp">
            <span class="text-xs text-on-surface-variant">{{ sp.data.resp_person || '—' }}</span>
          </template>
        </Column>
      </DataTable>
    </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import api from '../lib/axios'

const toast = useToast()
const loading = ref(true)
const refreshing = ref(false)
const search = ref('')
const statusFilter = ref('all')
const leadTypeFilter = ref('all')
const campaignFilter = ref('all')

const leads = ref([])
const campaignSummary = ref([])
const dataSource = ref('local')

onMounted(() => fetchData())

const fetchData = async () => {
  loading.value = true
  try {
    const res = await api.get('/bitrix24/leads')
    leads.value = res.data.leads || []
    campaignSummary.value = res.data.campaign_summary || []
    dataSource.value = 'bitrix24'
  } catch (e) {
    dataSource.value = 'local'
    leads.value = []
    campaignSummary.value = []
    if (e.response?.status === 400) {
      toast.add({ severity: 'warn', summary: 'Bitrix24', detail: 'Chưa cấu hình webhook. Vào Cài đặt → nhập Webhook URL → Lưu.', life: 6000 })
    }
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  refreshing.value = true
  await fetchData()
  refreshing.value = false
  toast.add({ severity: 'success', summary: 'Đã làm mới', detail: `${leads.value.length} leads từ Bitrix24.`, life: 2000 })
}

const countByStatus = (status) => leads.value.filter(l => l.status === status).length

const filteredLeads = computed(() => {
  let result = leads.value
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(l => (l.name || '').toLowerCase().includes(q))
  }
  if (statusFilter.value !== 'all') {
    result = result.filter(l => l.status === statusFilter.value)
  }
  if (leadTypeFilter.value !== 'all') {
    result = result.filter(l => l.lead_type === leadTypeFilter.value)
  }
  if (campaignFilter.value !== 'all') {
    result = result.filter(l => l.campaign === campaignFilter.value)
  }
  return result
})

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return dateStr }
}

const getStatusClass = (status) => {
  const base = "px-3 py-1 rounded-full text-[10px] font-black uppercase "
  if (status === 'CHỐT ĐƠN') return base + "bg-primary/10 text-primary border border-primary/20"
  if (status === 'THẤT BẠI') return base + "bg-error/10 text-error border border-error/20"
  if (status === 'ĐANG TƯ VẤN') return base + "bg-amber-100 text-amber-700 border border-amber-200"
  return base + "bg-blue-50 text-blue-700 border border-blue-200"
}

const exportCSV = () => {
  const headers = ['ID', 'Ngày tạo', 'Tên', 'Chiến dịch', 'Loại lead', 'Chi tiết', 'Trạng thái', 'Phụ trách']
  const rows = filteredLeads.value.map(l => [l.id, l.created_at, l.name, l.campaign, l.lead_type || '', l.old_status || '', l.status, l.resp_person || ''])
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `leads_bitrix24_${Date.now()}.csv`
  link.click()
  toast.add({ severity: 'success', summary: 'Đã xuất', detail: 'Đã tải CSV.', life: 2000 })
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

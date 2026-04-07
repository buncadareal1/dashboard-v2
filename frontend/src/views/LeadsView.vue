<template>
    <div class="space-y-6">
        <h1 class="text-xl font-bold text-gray-900">Leads</h1>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Tổng Leads" :value="meta.total" icon="people" color="blue" />
            <KpiCard label="Mới" :value="statusCount('MỚI')" icon="fiber_new" color="emerald" />
            <KpiCard label="Đang tư vấn" :value="statusCount('ĐANG TƯ VẤN')" icon="support_agent" color="amber" />
            <KpiCard label="Chốt đơn" :value="statusCount('CHỐT ĐƠN')" icon="check_circle" color="emerald" />
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3">
            <select v-model="filterStatus" class="px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="">Tất cả trạng thái</option>
                <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
            <input v-model="filterSearch" placeholder="Tìm tên / SĐT..." class="px-3 py-2 text-sm border border-gray-200 rounded-lg w-64" />
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-gray-50 text-gray-500 uppercase tracking-wider">
                        <tr>
                            <th class="px-4 py-3 text-left">Ngày tạo</th>
                            <th class="px-4 py-3 text-left">Tên</th>
                            <th class="px-4 py-3 text-left">SĐT</th>
                            <th class="px-4 py-3 text-left">Nguồn</th>
                            <th class="px-4 py-3 text-left">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="lead in leads" :key="lead.id" class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-gray-500">{{ formatDate(lead.created_at) }}</td>
                            <td class="px-4 py-3 font-medium text-gray-900">{{ lead.name }}</td>
                            <td class="px-4 py-3 text-gray-600">{{ lead.phone || '—' }}</td>
                            <td class="px-4 py-3 text-gray-600 max-w-[150px] truncate">{{ lead.source || '—' }}</td>
                            <td class="px-4 py-3">
                                <select
                                    :value="lead.status"
                                    @change="onStatusChange(lead.id, $event.target.value)"
                                    :class="statusBadgeClass(lead.status)"
                                    class="text-[11px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer"
                                >
                                    <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
                                </select>
                            </td>
                        </tr>
                        <tr v-if="!leads.length && !store.isLoading">
                            <td colspan="5" class="px-4 py-8 text-center text-gray-400">Chưa có leads</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppDataStore } from '../stores/appData'
import KpiCard from '../components/ui/KpiCard.vue'

const store = useAppDataStore()
const filterStatus = ref('')
const filterSearch = ref('')
const statuses = ['MỚI', 'ĐANG TƯ VẤN', 'CHỐT ĐƠN', 'THẤT BẠI']

const leads = computed(() => store.leads || [])
const meta = computed(() => store.leadsMeta || { total: 0 })

const statusCount = (status) =>
    leads.value.filter(l => l.status === status).length

const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const statusBadgeClass = (status) => {
    switch (status) {
        case 'MỚI': return 'bg-blue-50 text-blue-700'
        case 'ĐANG TƯ VẤN': return 'bg-amber-50 text-amber-700'
        case 'CHỐT ĐƠN': return 'bg-emerald-50 text-emerald-700'
        case 'THẤT BẠI': return 'bg-red-50 text-red-700'
        default: return 'bg-gray-100 text-gray-600'
    }
}

const onStatusChange = async (leadId, newStatus) => {
    const ok = await store.updateLeadStatus(leadId, newStatus)
    if (ok) loadLeads()
}

const loadLeads = () => {
    const params = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterSearch.value) params.search = filterSearch.value
    store.fetchLeads(params)
}

watch([filterStatus, filterSearch], loadLeads, { debounce: 300 })
onMounted(loadLeads)
</script>

<template>
  <div class="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
    <div class="p-6 md:px-8 border-b border-slate-200 flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-start md:items-center bg-slate-50">
      <div>
        <h3 class="font-headline font-black text-lg text-on-surface">Facebook Ads ↔ Bitrix24 CRM</h3>
        <p class="text-xs font-medium text-on-surface-variant mt-1">
          Đồng bộ chỉ số quảng cáo + lead thật từ CRM
          <span v-if="mergedData.totals" class="ml-2 font-bold">— {{ mergedData.totals.leads }} leads, {{ mergedData.totals.orders }} chốt đơn, tỷ lệ {{ mergedData.totals.avg_close_rate }}%</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="$emit('sync')" class="bg-slate-100 border border-slate-300 text-black px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-all">
          <span class="material-symbols-outlined text-[14px]" :class="{'animate-spin': mergedLoading}">sync</span> Đồng bộ
        </button>
        <button @click="$emit('export')" class="bg-primary/10 border border-primary/30 text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
          <span class="material-symbols-outlined text-[14px]">download</span> CSV
        </button>
      </div>
    </div>

    <div v-if="mergedLoading" class="p-8 animate-pulse space-y-3">
      <div class="h-8 bg-slate-100 rounded w-full"></div>
      <div class="h-8 bg-slate-100 rounded w-full"></div>
      <div class="h-8 bg-slate-100 rounded w-4/5"></div>
    </div>

    <div v-else>
      <DataTable :value="mergedData.campaigns || []" paginator :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]"
                 stripedRows :rowHover="true" class="p-datatable-sm" scrollable scrollHeight="flex"
                 paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
                 currentPageReportTemplate="Hiển thị {first} đến {last} / {totalRecords} chiến dịch"
                 emptyMessage="Tải dữ liệu CSV + cấu hình Bitrix24 webhook để xem bảng đồng bộ.">
        <!-- Always visible columns -->
        <Column field="name" header="Chiến dịch" frozen style="min-width: 180px">
          <template #body="{ data: m }">
            <p class="font-bold text-sm text-on-surface">{{ m.name }}</p>
            <p v-if="m.matched_b24 && m.matched_b24 !== m.name" class="text-[10px] text-primary font-mono">↔ {{ m.matched_b24 }}</p>
          </template>
        </Column>
        <Column field="spend" header="Chi tiêu" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 100px">
          <template #body="{ data: m }">
            <span class="text-[13px] font-bold text-blue-700">{{ m.spend > 0 ? m.spend.toLocaleString() : '—' }}</span>
          </template>
        </Column>

        <!-- Hidden on mobile -->
        <Column v-if="!isMobile" field="impressions" header="Hiển thị" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 100px">
          <template #body="{ data: m }">
            <span class="text-[13px] text-on-surface-variant">{{ m.impressions > 0 ? m.impressions.toLocaleString() : '—' }}</span>
          </template>
        </Column>
        <Column v-if="!isMobile" field="clicks" header="Click" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 80px">
          <template #body="{ data: m }">
            <span class="text-[13px] font-bold text-primary">{{ m.clicks > 0 ? m.clicks.toLocaleString() : '—' }}</span>
          </template>
        </Column>
        <Column field="ctr" header="CTR" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 70px">
          <template #body="{ data: m }">
            <span v-if="m.ctr > 0" class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="m.ctr >= 2 ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'">{{ m.ctr }}%</span>
            <span v-else class="text-xs text-on-surface-variant">—</span>
          </template>
        </Column>

        <!-- Core CRM columns - always visible -->
        <Column field="total_leads" header="Leads" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 70px">
          <template #body="{ data: m }">
            <span class="text-[13px] font-black text-violet-700">{{ m.total_leads || 0 }}</span>
          </template>
        </Column>
        <Column field="leads_chot" header="Chốt đơn" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 80px">
          <template #body="{ data: m }">
            <span class="text-[13px] font-black text-amber-700">{{ m.leads_chot || 0 }}</span>
          </template>
        </Column>
        <Column field="close_rate" header="Tỷ lệ chốt" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 90px">
          <template #body="{ data: m }">
            <span class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="m.close_rate >= 30 ? 'bg-primary/10 text-primary' : m.close_rate >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-error/10 text-error'">{{ m.close_rate }}%</span>
          </template>
        </Column>

        <!-- Hidden on mobile -->
        <Column v-if="!isMobile" field="cpl_real" header="CPL thật" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 90px">
          <template #body="{ data: m }">
            <span v-if="m.cpl_real > 0" class="text-[12px] font-bold" :class="m.cpl_real > 15 ? 'text-error' : 'text-on-surface'">{{ m.cpl_real.toLocaleString() }}</span>
            <span v-else class="text-xs text-on-surface-variant">—</span>
          </template>
        </Column>
        <Column v-if="!isMobile" field="cost_per_order" header="Chi phí/đơn" headerStyle="text-align: right" bodyStyle="text-align: right" style="min-width: 100px">
          <template #body="{ data: m }">
            <span v-if="m.cost_per_order > 0" class="text-[12px] font-bold" :class="m.cost_per_order > 50 ? 'text-error' : 'text-primary'">{{ m.cost_per_order.toLocaleString() }}</span>
            <span v-else class="text-xs text-on-surface-variant">—</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

defineProps({
  mergedData: { type: Object, default: () => ({}) },
  mergedLoading: { type: Boolean, default: false },
})

defineEmits(['sync', 'export'])

const isMobile = ref(window.innerWidth < 768)

const onResize = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

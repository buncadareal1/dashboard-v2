<template>
    <div class="space-y-6">
        <!-- Back + Header -->
        <div class="flex items-center gap-3">
            <router-link to="/campaigns" class="p-1.5 rounded-lg hover:bg-gray-100">
                <span class="material-symbols-outlined text-gray-500">arrow_back</span>
            </router-link>
            <div>
                <h1 class="text-lg font-bold text-gray-900">{{ campaign?.name || 'Campaign' }}</h1>
                <p class="text-xs text-gray-500">{{ campaign?.matched_b24 ? `Matched Bitrix: ${campaign.matched_b24}` : 'Chưa match Bitrix24' }}</p>
            </div>
        </div>

        <!-- KPI row -->
        <div v-if="campaign" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Chi tiêu" :value="formatVndShort(campaign.spend)" icon="payments" color="emerald" />
            <KpiCard label="Impressions" :value="formatNumber(campaign.impressions)" icon="visibility" color="blue" />
            <KpiCard label="Clicks / CTR" :value="`${formatNumber(campaign.clicks)} / ${formatPercent(campaign.ctr)}`" icon="ads_click" color="amber" />
            <KpiCard label="Leads / CPL" :value="`${campaign.total_leads} / ${formatVndShort(campaign.cpl_real)}`" icon="people" color="violet" />
        </div>

        <!-- Timeseries chart -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h2 class="text-sm font-semibold text-gray-900 mb-4">Spend theo ngày (30 ngày)</h2>
            <BarChart v-if="chartData.length" :data="chartData" :categories="chartCategories" height="250" />
            <p v-else class="text-center text-gray-400 py-8">Chưa có dữ liệu time-series</p>
        </div>

        <!-- Lead funnel -->
        <div v-if="campaign" class="bg-white rounded-xl border border-gray-200 p-5">
            <h2 class="text-sm font-semibold text-gray-900 mb-4">Phễu chuyển đổi</h2>
            <div class="flex items-end gap-2 h-32">
                <div v-for="stage in funnel" :key="stage.label" class="flex-1 flex flex-col items-center gap-1">
                    <span class="text-sm font-bold text-gray-900">{{ stage.value }}</span>
                    <div :class="stage.color" class="w-full rounded-t-lg transition-all" :style="{ height: stage.height }"></div>
                    <span class="text-[10px] text-gray-500 text-center">{{ stage.label }}</span>
                </div>
            </div>
        </div>

        <!-- AI Analyze button -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-gray-900">AI Insights</h2>
                <button @click="runAi" :disabled="aiLoading" class="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                    {{ aiLoading ? 'Đang phân tích...' : 'Phân tích AI' }}
                </button>
            </div>
            <div v-if="store.aiInsights" class="prose prose-sm text-gray-700 text-xs whitespace-pre-wrap">{{ store.aiInsights }}</div>
            <p v-else class="text-xs text-gray-400">Nhấn "Phân tích AI" để nhận đề xuất tối ưu chiến dịch.</p>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAppDataStore } from '../stores/appData'
import KpiCard from '../components/ui/KpiCard.vue'
import BarChart from '../components/ui/BarChart.vue'
import { formatVndShort, formatNumber, formatPercent } from '../lib/format'

const route = useRoute()
const store = useAppDataStore()
const aiLoading = ref(false)
const timeseries = ref([])

const campaign = computed(() =>
    (store.campaigns || []).find(c => c.name === route.params.id)
)

const chartData = computed(() => timeseries.value.map(d => d.spend))
const chartCategories = computed(() => timeseries.value.map(d => d.date?.slice(5) || ''))

const funnel = computed(() => {
    const c = campaign.value
    if (!c) return []
    const max = Math.max(c.impressions, 1)
    return [
        { label: 'Impressions', value: formatNumber(c.impressions), height: '100%', color: 'bg-blue-200' },
        { label: 'Clicks', value: formatNumber(c.clicks), height: `${Math.max(c.clicks / max * 100, 5)}%`, color: 'bg-blue-300' },
        { label: 'Leads', value: c.total_leads, height: `${Math.max(c.total_leads / max * 100, 5)}%`, color: 'bg-emerald-300' },
        { label: 'Tư vấn', value: c.leads_tu_van, height: `${Math.max(c.leads_tu_van / max * 100, 5)}%`, color: 'bg-amber-300' },
        { label: 'Chốt đơn', value: c.leads_chot, height: `${Math.max(c.leads_chot / max * 100, 5)}%`, color: 'bg-emerald-500' },
    ]
})

const runAi = async () => {
    aiLoading.value = true
    await store.requestAiAnalysis(route.params.id)
    aiLoading.value = false
}

onMounted(async () => {
    if (!store.campaigns.length) await store.fetchCampaigns()
    if (campaign.value?.campaign_id) {
        timeseries.value = await store.fetchCampaignTimeseries(campaign.value.campaign_id)
    }
})
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold text-gray-900">Campaigns</h1>
            <span class="text-sm text-gray-500">{{ campaigns.length }} chiến dịch</span>
        </div>

        <!-- Filter tabs -->
        <div class="flex gap-2">
            <button
                v-for="tab in tabs" :key="tab.key"
                @click="activeTab = tab.key"
                :class="activeTab === tab.key
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            >
                {{ tab.label }} ({{ tab.count }})
            </button>
        </div>

        <!-- Search -->
        <input
            v-model="search"
            type="text"
            placeholder="Tìm campaign..."
            class="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />

        <!-- Campaign grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <router-link
                v-for="c in filtered" :key="c.name"
                :to="{ name: 'CampaignDetail', params: { id: c.name } }"
                class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
                <div class="flex items-start justify-between mb-3">
                    <h3 class="text-sm font-semibold text-gray-900 truncate max-w-[70%]">{{ c.name }}</h3>
                    <span :class="statusClass(c)" class="text-[10px] font-medium px-2 py-0.5 rounded-full">
                        {{ c.matched_b24 ? 'Matched' : 'FB Only' }}
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-3 text-xs">
                    <div>
                        <p class="text-gray-400">Spend</p>
                        <p class="font-semibold text-gray-900">{{ formatVndShort(c.spend) }}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Leads</p>
                        <p class="font-semibold text-gray-900">{{ c.total_leads }}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">CPL</p>
                        <p class="font-semibold text-gray-900">{{ formatVndShort(c.cpl_real) }}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Clicks</p>
                        <p class="font-semibold text-gray-900">{{ formatNumber(c.clicks) }}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">CTR</p>
                        <p class="font-semibold text-gray-900">{{ formatPercent(c.ctr) }}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Chốt</p>
                        <p class="font-semibold text-emerald-600">{{ c.leads_chot }}</p>
                    </div>
                </div>
            </router-link>
        </div>

        <p v-if="!filtered.length && !store.isLoading" class="text-center text-gray-400 py-8">Không tìm thấy campaign</p>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppDataStore } from '../stores/appData'
import { formatVndShort, formatNumber, formatPercent } from '../lib/format'

const store = useAppDataStore()
const activeTab = ref('all')
const search = ref('')

const campaigns = computed(() => store.campaigns || [])

const tabs = computed(() => {
    const all = campaigns.value
    return [
        { key: 'all', label: 'Tất cả', count: all.length },
        { key: 'has_leads', label: 'Có leads', count: all.filter(c => c.total_leads > 0).length },
        { key: 'no_leads', label: 'Chưa có leads', count: all.filter(c => c.total_leads === 0).length },
    ]
})

const filtered = computed(() => {
    let list = campaigns.value
    if (activeTab.value === 'has_leads') list = list.filter(c => c.total_leads > 0)
    if (activeTab.value === 'no_leads') list = list.filter(c => c.total_leads === 0)
    if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    return list
})

const statusClass = (c) =>
    c.total_leads > 0
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-gray-100 text-gray-500'

onMounted(() => store.fetchCampaigns())
</script>

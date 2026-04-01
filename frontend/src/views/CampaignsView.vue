<template>
  <div class="space-y-8 fade-in-animation">
    <!-- LOADING SKELETON -->
    <div v-if="loading" class="animate-pulse space-y-6">
      <div class="h-48 bg-slate-100 rounded-2xl"></div>
      <div class="h-64 bg-slate-100 rounded-2xl"></div>
    </div>

    <!-- MAIN CONTENT -->
    <template v-else>
    <!-- HEADER -->
    <div class="bg-surface-container-lowest p-10 rounded-2xl relative overflow-hidden border border-slate-200 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
       <div>
         <p class="text-xs font-bold text-primary mb-2 flex gap-1 uppercase tracking-widest"><span class="material-symbols-outlined text-[16px]">public</span> Quản lý chiến dịch</p>
         <h2 class="text-4xl font-headline font-black text-on-surface tracking-tight mb-2">Phễu Marketing</h2>
         <p class="text-sm font-medium text-on-surface-variant max-w-lg leading-relaxed">Trực quan hóa toàn phễu từ quảng cáo đến mua hàng — xem chính xác người dùng rơi ở đâu.</p>
       </div>
       <div class="flex items-center gap-3">
         <select v-model="statusFilter" class="bg-surface border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20">
           <option value="all">Tất cả</option>
           <option value="ACTIVE">Đang chạy</option>
           <option value="PAUSED">Tạm dừng</option>
         </select>
         <button @click="refreshData" class="bg-slate-100 border border-slate-300 hover:bg-slate-200 active:scale-95 transition-all shadow-sm px-6 py-3 rounded-xl font-bold text-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
           <span class="material-symbols-outlined text-[16px]" :class="{'animate-spin': loading}" style="font-variation-settings: 'FILL' 1;">sync</span> Làm mới
         </button>
       </div>
    </div>

    <!-- NEW FUNNEL: HORIZONTAL BAR DROP-OFF -->
    <div class="bg-surface-container-lowest p-8 lg:p-10 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h3 class="font-headline text-2xl font-bold text-on-surface">Phễu chuyển đổi</h3>
          <p class="text-on-surface-variant text-sm font-medium mt-1">Mỗi thanh thể hiện số lượng — mũi tên cho thấy tỷ lệ rơi giữa các giai đoạn</p>
        </div>
        <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
          <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-500"></span> Số lượng</div>
          <div class="flex items-center gap-1.5"><span class="material-symbols-outlined text-error text-[14px]">south</span> Tỷ lệ rơi</div>
        </div>
      </div>

      <div class="space-y-2">
        <!-- Stage bars -->
        <div v-for="(stage, idx) in funnelStages" :key="stage.key">
          <!-- Bar row -->
          <div class="flex items-center gap-4 group cursor-pointer" @click="selectStage(stage.key)">
            <!-- Label -->
            <div class="w-32 shrink-0 text-right">
              <p class="text-[11px] font-black uppercase tracking-wider" :class="stage.labelColor">{{ stage.label }}</p>
              <p class="text-[10px] text-on-surface-variant font-medium">{{ stage.sublabel }}</p>
            </div>
            <!-- Bar -->
            <div class="flex-1 relative">
              <div class="w-full bg-slate-100 rounded-lg h-14 border relative" :class="selectedStage === stage.key ? 'border-2 border-blue-400' : 'border-slate-200'">
                <div class="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                     :class="stage.barColor"
                     :style="`width: ${stage.widthPercent}%`">
                </div>
                <span class="absolute inset-0 flex items-center px-4 text-lg font-black text-black z-10">{{ stage.value.toLocaleString() }}</span>
              </div>
            </div>
            <!-- Rate -->
            <div class="w-20 shrink-0 text-right">
              <p class="text-lg font-black" :class="stage.rateColor">{{ stage.rate }}</p>
              <p class="text-[9px] text-on-surface-variant font-bold uppercase">{{ stage.rateLabel }}</p>
            </div>
          </div>

          <!-- Drop-off arrow between stages -->
          <div v-if="idx < funnelStages.length - 1" class="flex items-center gap-4 py-1">
            <div class="w-32 shrink-0"></div>
            <div class="flex-1 flex items-center gap-3 pl-2">
              <span class="material-symbols-outlined text-[18px]" :class="getDropColor(funnelDrops[idx].percent)">south</span>
              <div class="flex-1 border-t-2 border-dashed" :class="getDropBorderColor(funnelDrops[idx].percent)"></div>
              <div class="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black" :class="getDropBadgeClass(funnelDrops[idx].percent)">
                <span class="material-symbols-outlined text-[12px]">trending_down</span>
                {{ funnelDrops[idx].label }}: -{{ funnelDrops[idx].lost.toLocaleString() }} ({{ funnelDrops[idx].percent }}% mất)
              </div>
            </div>
            <div class="w-20 shrink-0"></div>
          </div>
        </div>
      </div>

      <!-- Funnel Summary -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200">
        <div class="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p class="text-[9px] font-black text-blue-600 uppercase tracking-widest">Tổng hiển thị</p>
          <p class="text-2xl font-black text-black mt-1">{{ funnelData.impressions.toLocaleString() }}</p>
        </div>
        <div class="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <p class="text-[9px] font-black text-emerald-600 uppercase tracking-widest">CTR</p>
          <p class="text-2xl font-black text-black mt-1">{{ funnelData.ctr }}%</p>
        </div>
        <div class="text-center p-4 bg-violet-50 rounded-xl border border-violet-200">
          <p class="text-[9px] font-black text-violet-600 uppercase tracking-widest">Tỷ lệ tương tác</p>
          <p class="text-2xl font-black text-black mt-1">{{ funnelData.engRate }}%</p>
        </div>
        <div class="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
          <p class="text-[9px] font-black text-amber-600 uppercase tracking-widest">Tỷ lệ chuyển đổi</p>
          <p class="text-2xl font-black text-black mt-1">{{ funnelData.convRate }}%</p>
        </div>
      </div>
    </div>

    <!-- CAMPAIGNS TABLE -->
    <div class="bg-surface-container-lowest rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div class="p-6 md:px-8 border-b border-slate-200 flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-start md:items-center">
        <div>
          <h3 class="font-headline font-black text-lg text-on-surface">Chi tiết chiến dịch</h3>
          <p class="text-xs font-medium text-on-surface-variant mt-1">{{ filteredCampaigns.length }} chiến dịch</p>
        </div>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input v-model="campSearch" type="text" placeholder="Tìm chiến dịch..." class="bg-surface border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 w-64" />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[1000px]">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Chiến dịch</th>
              <th class="px-3 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right">Chi tiêu</th>
              <th class="px-3 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Lượt hiển thị</th>
              <th class="px-3 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Lượt click</th>
              <th class="px-3 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">CTR</th>
              <th class="px-3 py-4 text-[10px] font-black text-violet-600 uppercase tracking-widest text-right">Tương tác</th>
              <th class="px-3 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right">Đơn hàng</th>
              <th class="px-3 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right">CR%</th>
              <th class="px-3 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">CPL</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="(c, idx) in filteredCampaigns" :key="c.name" @click="$router.push(`/campaigns/${c.originalIndex}`)" class="hover:bg-primary/5 transition-colors cursor-pointer group">
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <span :class="`w-2 h-2 rounded-full ${c.status==='ACTIVE'?'bg-primary':'bg-slate-300'}`"></span>
                  <div>
                    <p class="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{{ c.name }}</p>
                    <p class="text-[10px] text-on-surface-variant font-mono uppercase">{{ c.type }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-4 text-right text-sm font-bold text-blue-700">{{ c.spend.toLocaleString() }}</td>
              <td class="px-3 py-4 text-right text-sm text-on-surface-variant">{{ c.impressions.toLocaleString() }}</td>
              <td class="px-3 py-4 text-right text-sm font-bold text-emerald-700">{{ c.clicks.toLocaleString() }}</td>
              <td class="px-3 py-4 text-right">
                <span class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="parseFloat(c.ctr) >= 2 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-error/10 text-error border border-error/20'">{{ c.ctr }}%</span>
              </td>
              <td class="px-3 py-4 text-right text-sm text-violet-700">{{ c.engagements.toLocaleString() }}</td>
              <td class="px-3 py-4 text-right text-sm font-black text-amber-700">{{ c.purchases }}</td>
              <td class="px-3 py-4 text-right">
                <span class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="c.crNum >= 3 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-amber-50 text-amber-700 border border-amber-200'">{{ c.cr }}%</span>
              </td>
              <td class="px-3 py-4 text-right">
                <span class="text-[12px] font-bold" :class="c.cplNum > 15 ? 'text-error' : 'text-on-surface'">{{ c.cplDisplay }}</span>
              </td>
              <td class="px-4 py-4 text-right">
                <span class="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider"
                      :class="c.status === 'ACTIVE' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container text-on-surface-variant border border-slate-200'">
                  {{ c.statusLabel }}
                </span>
              </td>
            </tr>
            <tr v-if="filteredCampaigns.length === 0">
              <td colspan="10" class="text-center py-12">
                <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">campaign</span>
                <p class="text-sm font-bold text-on-surface-variant">Không tìm thấy chiến dịch</p>
                <p class="text-xs text-on-surface-variant mt-1">Tải dữ liệu qua Kết nối API hoặc điều chỉnh bộ lọc.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppDataStore } from '../stores/appData'

const appData = useAppDataStore()
const loading = ref(false)
const statusFilter = ref('all')
const campSearch = ref('')
const selectedStage = ref(null)

const selectStage = (stage) => {
  selectedStage.value = selectedStage.value === stage ? null : stage
}

const refreshData = async () => {
  loading.value = true
  await appData.fetchCampaigns()
  loading.value = false
}

// Transform raw campaign data
const campaigns = computed(() => {
  return appData.topCampaigns.map((c, idx) => {
    const impressions = c.imp || Math.floor((c.spend || 0) * 8.5)
    const clicks = c.clicks || Math.floor(impressions * 0.02)
    const engagements = c.engagements || Math.floor(impressions * 0.05)
    const purchases = c.purchases || Math.floor(clicks * 0.03)
    const spend = c.spend || 0
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0
    const cr = clicks > 0 ? ((purchases / clicks) * 100).toFixed(2) : 0
    const cplNum = purchases > 0 ? spend / purchases : 0
    const status = c.status || 'ACTIVE'
    return {
      name: c.name || 'Chiến dịch chưa đặt tên',
      type: c.source_sheet ? 'TẢI CSV' : 'FACEBOOK API',
      spend,
      impressions,
      clicks,
      engagements,
      purchases,
      ctr,
      cr,
      crNum: parseFloat(cr),
      cplNum,
      cplDisplay: cplNum.toFixed(2),
      status,
      statusLabel: status === 'ACTIVE' ? 'ĐANG CHẠY' : 'TẠM DỪNG',
      originalIndex: idx
    }
  })
})

const filteredCampaigns = computed(() => {
  let result = campaigns.value
  if (statusFilter.value !== 'all') {
    result = result.filter(c => c.status === statusFilter.value)
  }
  if (campSearch.value) {
    const q = campSearch.value.toLowerCase()
    result = result.filter(c => c.name.toLowerCase().includes(q))
  }
  return result
})

// Funnel aggregation
const funnelData = computed(() => {
  const camps = filteredCampaigns.value
  let imp = 0, clicks = 0, eng = 0, pur = 0
  camps.forEach(c => {
    imp += c.impressions
    clicks += c.clicks
    eng += c.engagements
    pur += c.purchases
  })
  return {
    impressions: imp,
    clicks,
    engagements: eng,
    purchases: pur,
    ctr: imp > 0 ? ((clicks / imp) * 100).toFixed(1) : 0,
    engRate: imp > 0 ? ((eng / imp) * 100).toFixed(1) : 0,
    convRate: clicks > 0 ? ((pur / clicks) * 100).toFixed(1) : 0
  }
})

// Funnel stages for bar visualization
const funnelStages = computed(() => {
  const f = funnelData.value
  const maxVal = Math.max(f.impressions, 1)
  return [
    { key: 'impressions', label: 'Lượt hiển thị', sublabel: 'Lượt xem QC', value: f.impressions, widthPercent: 100, rate: '100%', rateLabel: 'Đầu phễu', labelColor: 'text-blue-600', barColor: 'bg-blue-100', rateColor: 'text-blue-600' },
    { key: 'clicks', label: 'Lượt click', sublabel: 'Click liên kết', value: f.clicks, widthPercent: Math.max((f.clicks / maxVal) * 100, 3), rate: f.ctr + '%', rateLabel: 'CTR', labelColor: 'text-emerald-600', barColor: 'bg-emerald-100', rateColor: 'text-emerald-600' },
    { key: 'engagements', label: 'Tương tác', sublabel: 'Lượt tương tác', value: f.engagements, widthPercent: Math.max((f.engagements / maxVal) * 100, 3), rate: f.engRate + '%', rateLabel: 'Tỷ lệ TT', labelColor: 'text-violet-600', barColor: 'bg-violet-100', rateColor: 'text-violet-600' },
    { key: 'purchases', label: 'Đơn hàng', sublabel: 'Chuyển đổi', value: f.purchases, widthPercent: Math.max((f.purchases / maxVal) * 100, 3), rate: f.convRate + '%', rateLabel: 'Tỷ lệ CĐ', labelColor: 'text-amber-600', barColor: 'bg-amber-100', rateColor: 'text-amber-600' },
  ]
})

// Drop-off between stages
const funnelDrops = computed(() => {
  const f = funnelData.value
  const drops = []
  const pairs = [
    { from: f.impressions, to: f.clicks, label: 'HT → Click' },
    { from: f.clicks, to: f.engagements, label: 'Click → TT' },
    { from: f.engagements, to: f.purchases, label: 'TT → Đơn hàng' },
  ]
  pairs.forEach(p => {
    const lost = Math.max(p.from - p.to, 0)
    const pct = p.from > 0 ? ((lost / p.from) * 100).toFixed(1) : 0
    drops.push({ label: p.label, lost, percent: pct })
  })
  return drops
})

const getDropColor = (pct) => {
  const p = parseFloat(pct)
  if (p >= 90) return 'text-error'
  if (p >= 60) return 'text-amber-500'
  return 'text-emerald-500'
}

const getDropBorderColor = (pct) => {
  const p = parseFloat(pct)
  if (p >= 90) return 'border-error/30'
  if (p >= 60) return 'border-amber-300'
  return 'border-emerald-300'
}

const getDropBadgeClass = (pct) => {
  const p = parseFloat(pct)
  if (p >= 90) return 'bg-error/10 text-error border border-error/20'
  if (p >= 60) return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

onMounted(() => {
  appData.fetchCampaigns()
})
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

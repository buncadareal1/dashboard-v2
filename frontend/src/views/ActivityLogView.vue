<template>
  <div class="space-y-8 fade-in-animation">
    <!-- LOADING SKELETON -->
    <div v-if="loading" class="animate-pulse space-y-6">
      <div class="h-32 bg-slate-100 rounded-2xl"></div>
      <div class="h-12 bg-slate-100 rounded-2xl"></div>
      <div class="h-64 bg-slate-100 rounded-2xl"></div>
    </div>

    <template v-if="!loading">
    <!-- HEADER -->
    <div class="bg-surface-container-lowest p-10 rounded-2xl relative overflow-hidden border border-slate-200 shadow-lg">
      <div>
        <p class="text-xs font-bold text-primary mb-2 flex gap-1 uppercase tracking-widest"><span class="material-symbols-outlined text-[16px]">history</span> Quản trị hệ thống</p>
        <h2 class="text-4xl font-headline font-black text-on-surface tracking-tight mb-2">Nhật ký hoạt động</h2>
        <p class="text-sm font-medium text-on-surface-variant max-w-lg leading-relaxed">Theo dõi toàn bộ hoạt động của người dùng trong hệ thống.</p>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="flex flex-wrap gap-4">
      <div class="relative flex-1 min-w-[200px] max-w-md">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input v-model="search" type="text" placeholder="Tìm theo hành động hoặc người dùng..." class="w-full bg-surface-container-lowest border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      </div>
      <select v-model="typeFilter" class="bg-surface-container-lowest border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
        <option value="all">Tất cả loại</option>
        <option value="auth">Xác thực</option>
        <option value="user">Người dùng</option>
        <option value="api">API</option>
        <option value="data">Dữ liệu</option>
        <option value="config">Cấu hình</option>
      </select>
    </div>

    <!-- ACTIVITY LIST -->
    <div class="bg-surface-container-lowest rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-8 py-5 border-b border-slate-200 bg-slate-50">
        <h3 class="font-headline font-black text-lg text-on-surface">Lịch sử hoạt động</h3>
        <p class="text-xs font-medium text-on-surface-variant mt-1">{{ filteredActivities.length }} hoạt động</p>
      </div>

      <div class="divide-y divide-slate-200">
        <div v-for="activity in filteredActivities" :key="activity.id" class="px-8 py-5 flex items-start gap-4 hover:bg-primary/5 transition-colors">
          <!-- Icon -->
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="getActivityIconBg(activity.action_type)">
            <span class="material-symbols-outlined text-[20px]" :class="getActivityIconColor(activity.action_type)" style="font-variation-settings: 'FILL' 1">{{ getActivityIcon(activity.action_type) }}</span>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-bold text-on-surface">{{ activity.username }}</span>
              <span class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider" :class="getActivityBadgeClass(activity.action_type)">{{ getActivityTypeLabel(activity.action_type) }}</span>
            </div>
            <p class="text-sm text-on-surface-variant">{{ activity.action }}</p>
            <p class="text-[10px] text-on-surface-variant/60 font-mono mt-1">{{ activity.created_at }}</p>
          </div>

          <!-- IP / Detail -->
          <div class="text-right shrink-0 hidden md:block">
            <p class="text-[10px] text-on-surface-variant font-mono">{{ activity.ip_address }}</p>
          </div>
        </div>
      </div>

      <div v-if="filteredActivities.length === 0" class="text-center py-12">
        <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">history</span>
        <p class="text-sm font-bold text-on-surface-variant">Không tìm thấy hoạt động nào</p>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../lib/axios'

const search = ref('')
const typeFilter = ref('all')
const loading = ref(true)

const activities = ref([])

onMounted(async () => {
  try {
    const response = await api.get('/admin/activity-log?limit=100')
    activities.value = response.data.logs
  } catch (e) {
    console.error('Failed to fetch activity logs:', e)
  } finally {
    loading.value = false
  }
})

const filteredActivities = computed(() => {
  let result = activities.value
  if (typeFilter.value !== 'all') {
    result = result.filter(a => a.action_type === typeFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(a => a.action.toLowerCase().includes(q) || a.username.toLowerCase().includes(q))
  }
  return result
})

const getActivityIcon = (type) => {
  const icons = { auth: 'login', user: 'person_add', api: 'api', data: 'description', config: 'settings' }
  return icons[type] || 'info'
}

const getActivityIconBg = (type) => {
  const bgs = { auth: 'bg-blue-100', user: 'bg-violet-100', api: 'bg-emerald-100', data: 'bg-amber-100', config: 'bg-rose-100' }
  return bgs[type] || 'bg-slate-100'
}

const getActivityIconColor = (type) => {
  const colors = { auth: 'text-blue-600', user: 'text-violet-600', api: 'text-emerald-600', data: 'text-amber-600', config: 'text-rose-600' }
  return colors[type] || 'text-slate-600'
}

const getActivityBadgeClass = (type) => {
  const classes = {
    auth: 'bg-blue-50 text-blue-700 border border-blue-200',
    user: 'bg-violet-50 text-violet-700 border border-violet-200',
    api: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    data: 'bg-amber-50 text-amber-700 border border-amber-200',
    config: 'bg-rose-50 text-rose-700 border border-rose-200'
  }
  return classes[type] || 'bg-slate-50 text-slate-700 border border-slate-200'
}

const getActivityTypeLabel = (type) => {
  const labels = { auth: 'Xác thực', user: 'Người dùng', api: 'API', data: 'Dữ liệu', config: 'Cấu hình' }
  return labels[type] || type
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

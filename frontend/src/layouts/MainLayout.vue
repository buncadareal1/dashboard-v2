<template>
  <div class="bg-surface font-body text-on-surface antialiased min-h-screen">

    <!-- LOADING BAR (NProgress-style) -->
    <div v-if="isNavigating" class="fixed top-0 left-0 w-full h-[3px] z-[9999]">
      <div class="h-full bg-primary animate-loading-bar"></div>
    </div>

    <!-- HEADER -->
    <header class="fixed top-0 z-50 w-full px-4 md:px-8 py-3 backdrop-blur-xl bg-white/90 flex justify-between items-center border-b border-slate-200 transition-colors shadow-sm">
      <div class="flex items-center gap-4 md:gap-10">
        <button @click="sidebarOpen = !sidebarOpen" class="md:hidden p-2 hover:bg-slate-100 rounded-lg">
          <span class="material-symbols-outlined text-on-surface">{{ sidebarOpen ? 'close' : 'menu' }}</span>
        </button>
        <span class="text-xl font-black text-primary font-headline uppercase tracking-tighter">SmartLand AI</span>
        <nav class="hidden md:flex gap-6">
          <router-link to="/" class="font-manrope tracking-wide uppercase text-xs font-bold text-[#414754] pb-1 transition-colors hover:text-primary" active-class="text-primary border-b-2 border-primary">Tổng quan</router-link>
          <router-link to="/campaigns" class="font-manrope tracking-wide uppercase text-xs font-bold text-[#414754] pb-1 transition-colors hover:text-primary" active-class="text-primary border-b-2 border-primary">Vận hành</router-link>
          <router-link to="/reports" class="font-manrope tracking-wide uppercase text-xs font-bold text-[#414754] pb-1 transition-colors hover:text-primary" active-class="text-primary border-b-2 border-primary">Báo cáo</router-link>
        </nav>
      </div>

      <div class="flex items-center gap-3 md:gap-5">
        <!-- Date Range Picker -->
        <div class="hidden lg:flex items-center gap-1 bg-surface-container rounded-xl p-1">
          <button v-for="p in datePresets" :key="p.key" @click="uiStore.setDatePreset(p.key)"
            class="px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all"
            :class="uiStore.datePreset === p.key ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'">
            {{ p.label }}
          </button>
          <div class="flex items-center gap-1 px-1">
            <input type="date" :value="uiStore.dateFrom" @input="uiStore.setCustomRange($event.target.value, uiStore.dateTo)" class="bg-transparent text-[10px] font-bold text-on-surface-variant outline-none w-[85px] cursor-pointer" />
            <span class="text-[10px] text-on-surface-variant">→</span>
            <input type="date" :value="uiStore.dateTo" @input="uiStore.setCustomRange(uiStore.dateFrom, $event.target.value)" class="bg-transparent text-[10px] font-bold text-on-surface-variant outline-none w-[85px] cursor-pointer" />
          </div>
        </div>

        <!-- Nút đồng bộ nhanh -->
        <button @click="syncAll" :disabled="syncing" class="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold transition-all"
          :class="syncing ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-on-surface-variant hover:bg-slate-200 hover:text-on-surface'">
          <span class="material-symbols-outlined text-[16px]" :class="{'animate-spin': syncing}">sync</span>
          <span class="hidden xl:inline">{{ syncing ? 'Đang đồng bộ...' : 'Đồng bộ' }}</span>
        </button>

        <!-- Thông báo dropdown -->
        <div class="relative">
          <button @click="showNotif = !showNotif" class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-lg hover:bg-slate-100">
            <span class="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <span v-if="uiStore.notifications.length > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>

          <!-- Dropdown -->
          <div v-if="showNotif" class="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div class="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span class="text-sm font-bold text-on-surface">Thông báo</span>
              <span class="text-[10px] font-bold text-on-surface-variant">{{ uiStore.notifications.length }} mới</span>
            </div>
            <div class="max-h-64 overflow-y-auto">
              <div v-for="n in uiStore.notifications" :key="n.id" class="px-5 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div class="flex items-start gap-3">
                  <span class="material-symbols-outlined text-[18px] mt-0.5" :class="n.type === 'error' ? 'text-error' : 'text-primary'">
                    {{ n.type === 'error' ? 'warning' : 'info' }}
                  </span>
                  <div>
                    <p class="text-xs font-bold text-on-surface">{{ n.title }}</p>
                    <p class="text-[11px] text-on-surface-variant mt-0.5">{{ n.desc }}</p>
                  </div>
                </div>
              </div>
              <div v-if="uiStore.notifications.length === 0" class="px-5 py-6 text-center text-sm text-on-surface-variant">Không có thông báo mới</div>
            </div>
          </div>
        </div>

        <!-- User info + avatar -->
        <router-link to="/profile" class="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-lg transition-all">
          <div class="h-8 w-8 rounded-full border border-slate-200 overflow-hidden shrink-0">
            <img v-if="authStore.avatar" :src="authStore.avatar" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
              {{ (authStore.username || '?')[0].toUpperCase() }}
            </div>
          </div>
          <div class="hidden xl:block">
            <p class="text-xs font-bold text-on-surface leading-tight">{{ authStore.username || 'Người dùng' }}</p>
            <p class="text-[10px] text-on-surface-variant leading-tight">{{ authStore.isAdmin ? 'Quản trị viên' : 'Nhân viên' }}</p>
          </div>
        </router-link>
      </div>
    </header>

    <!-- Click outside đóng notification -->
    <div v-if="showNotif" @click="showNotif = false" class="fixed inset-0 z-40"></div>

    <!-- Overlay mobile sidebar -->
    <div v-if="sidebarOpen" @click="sidebarOpen = false" class="fixed inset-0 bg-black/30 z-30 md:hidden"></div>

    <!-- SIDEBAR -->
    <aside :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
      class="fixed left-0 top-0 h-screen w-64 bg-white flex flex-col py-6 z-40 pt-20 border-r border-slate-200 shadow-sm transition-transform duration-300">
      <div class="px-6 mb-6">
        <div class="flex items-center gap-3 py-4 border-b border-slate-200">
          <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">architecture</span>
          </div>
          <div>
            <h2 class="font-inter text-sm font-bold text-on-surface">{{ authStore.username || 'Quản trị' }}</h2>
            <p class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">{{ authStore.isAdmin ? 'Quản trị viên' : 'Nhân viên' }}</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto">
        <p class="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] px-6 pt-2 pb-1">Phân tích</p>
        <router-link @click="closeMobile" to="/" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">dashboard</span><span>Bảng điều khiển</span>
        </router-link>
        <router-link @click="closeMobile" to="/campaigns" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">ads_click</span><span>Chiến dịch</span>
        </router-link>
        <router-link @click="closeMobile" to="/reports" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">bar_chart</span><span>Báo cáo</span>
        </router-link>
        <router-link @click="closeMobile" to="/leads" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">contacts</span><span>Khách hàng tiềm năng</span>
        </router-link>

        <template v-if="authStore.isAdmin">
          <p class="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] px-6 pt-4 pb-1">Quản lý</p>
          <router-link @click="closeMobile" to="/users" class="nav-item" active-class="nav-active">
            <span class="material-symbols-outlined text-[20px]">group</span><span>Người dùng & Phân quyền</span>
          </router-link>
          <router-link @click="closeMobile" to="/api-hub" class="nav-item" active-class="nav-active">
            <span class="material-symbols-outlined text-[20px]">api</span><span>Kết nối API</span>
          </router-link>
          <router-link @click="closeMobile" to="/ai-analytics" class="nav-item" active-class="nav-active">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">psychology</span><span>Quy tắc AI</span>
          </router-link>
          <router-link @click="closeMobile" to="/activity-log" class="nav-item" active-class="nav-active">
            <span class="material-symbols-outlined text-[20px]">history</span><span>Nhật ký hoạt động</span>
          </router-link>
        </template>

        <p class="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] px-6 pt-4 pb-1">Cá nhân</p>
        <router-link @click="closeMobile" to="/profile" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">person</span><span>Hồ sơ</span>
        </router-link>
        <router-link @click="closeMobile" to="/settings" class="nav-item" active-class="nav-active">
          <span class="material-symbols-outlined text-[20px]">settings</span><span>Cài đặt</span>
        </router-link>
      </nav>

      <!-- Trạng thái hệ thống -->
      <div class="px-6 py-3 border-t border-slate-200">
        <p class="text-[9px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-2">Trạng thái hệ thống</p>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.api ? 'bg-primary' : 'bg-error'"></span>
            <span class="text-[10px] text-on-surface-variant">API Server</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.bitrix ? 'bg-primary' : 'bg-amber-500'"></span>
            <span class="text-[10px] text-on-surface-variant">Bitrix24 CRM</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.ai ? 'bg-primary' : 'bg-amber-500'"></span>
            <span class="text-[10px] text-on-surface-variant">AI Gemini</span>
          </div>
        </div>
      </div>

      <div class="px-6 mt-auto space-y-4">
        <div class="pt-4 border-t border-slate-200">
          <button @click="authStore.logout" class="w-full flex items-center gap-4 font-inter text-sm font-bold text-on-surface-variant py-2 hover:text-error transition-colors text-left pl-1">
            <span class="material-symbols-outlined text-[20px]">logout</span><span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>

    <main class="md:ml-64 pt-20 pb-12 px-4 md:px-8 min-h-screen relative fade-in">
      <Toast position="bottom-right" />

      <!-- Onboarding cho user mới -->
      <div v-if="showOnboarding" class="mb-6 p-6 bg-primary/5 border border-primary/20 rounded-2xl relative">
        <button @click="dismissOnboarding" class="absolute top-3 right-3 p-1 hover:bg-primary/10 rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant text-[18px]">close</span>
        </button>
        <h3 class="text-lg font-headline font-bold text-on-surface mb-3">👋 Chào mừng đến SmartLand AI!</h3>
        <p class="text-sm text-on-surface-variant mb-4">Hoàn thành 3 bước sau để bắt đầu sử dụng:</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <router-link to="/api-hub" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all group">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">upload</span></div>
              <div>
                <p class="text-xs font-bold text-on-surface group-hover:text-primary">Bước 1: Tải dữ liệu</p>
                <p class="text-[10px] text-on-surface-variant">Upload CSV hoặc kết nối Facebook</p>
              </div>
            </div>
          </router-link>
          <router-link to="/settings" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all group">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">webhook</span></div>
              <div>
                <p class="text-xs font-bold text-on-surface group-hover:text-primary">Bước 2: Kết nối Bitrix24</p>
                <p class="text-[10px] text-on-surface-variant">Nhập webhook URL trong Cài đặt</p>
              </div>
            </div>
          </router-link>
          <router-link to="/" class="p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all group">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">dashboard</span></div>
              <div>
                <p class="text-xs font-bold text-on-surface group-hover:text-primary">Bước 3: Xem Dashboard</p>
                <p class="text-[10px] text-on-surface-variant">Phân tích chiến dịch & leads</p>
              </div>
            </div>
          </router-link>
        </div>
      </div>

      <router-view />
    </main>

    <!-- Footer với phiên bản -->
    <footer class="md:ml-64 px-4 md:px-8 py-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-on-surface-variant">
      <span>SmartLand AI Dashboard v1.0.0</span>
      <span>© 2026 SmartLand & SmartRealtors</span>
    </footer>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { useAppDataStore } from '../stores/appData'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const appData = useAppDataStore()
const toast = useToast()

const sidebarOpen = ref(false)
const showNotif = ref(false)
const syncing = ref(false)

// Feature 5: Loading bar
const isNavigating = ref(false)
router.beforeEach(() => { isNavigating.value = true })
router.afterEach(() => { setTimeout(() => { isNavigating.value = false }, 300) })

// Feature 6: Trạng thái kết nối hệ thống
const systemStatus = ref({ api: false, bitrix: false, ai: false })

const checkSystemStatus = async () => {
  try {
    await api.get('/health')
    systemStatus.value.api = true
  } catch { systemStatus.value.api = false }

  try {
    await api.post('/bitrix24/test')
    systemStatus.value.bitrix = true
  } catch { systemStatus.value.bitrix = false }

  // AI always true if Gemini key exists in env
  systemStatus.value.ai = true
}

// Feature 7: Onboarding cho user mới
const showOnboarding = ref(!localStorage.getItem('onboarding_dismissed'))
const dismissOnboarding = () => {
  showOnboarding.value = false
  localStorage.setItem('onboarding_dismissed', 'true')
}

const datePresets = [
  { key: '7d', label: '7N' },
  { key: '14d', label: '14N' },
  { key: '30d', label: '30N' },
  { key: '90d', label: '90N' },
]

const closeMobile = () => { sidebarOpen.value = false }

const syncAll = async () => {
  syncing.value = true
  try {
    await Promise.all([
      appData.fetchDashboardStats(),
      appData.fetchCampaigns(),
      appData.fetchIntegrations(),
      appData.fetchSheetIntegrations(),
    ])
    toast.add({ severity: 'success', summary: 'Đã đồng bộ', detail: 'Dữ liệu đã được cập nhật.', life: 2000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể đồng bộ dữ liệu.', life: 3000 })
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  checkSystemStatus()
})
</script>

<style scoped>
.fade-in { animation: smoothLoad 0.5s ease-in-out; }
@keyframes smoothLoad { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
.nav-item { display: flex; align-items: center; gap: 1rem; font-size: 0.875rem; font-weight: 500; color: #414754; padding: 0.75rem 0 0.75rem 1.5rem; transition: all 0.3s; }
.nav-item:hover { background: rgb(248 250 252); color: #006d33; }
.nav-active { color: #006d33; border-left: 4px solid #006d33; background: rgba(0, 109, 51, 0.05); }
@keyframes loadingBar { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
.animate-loading-bar { animation: loadingBar 0.8s ease-in-out; }
</style>

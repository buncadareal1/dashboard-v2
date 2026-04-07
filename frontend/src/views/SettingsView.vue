<template>
  <div class="p-6 space-y-6">
    <div>
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-2xl font-semibold text-slate-900">Settings</h1>
        <MockDataBanner :show="usingMock" />
      </div>
      <p class="text-sm text-slate-500 mt-1">Quản lý cài đặt hệ thống và tài khoản</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Vertical sub-nav -->
      <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-3 h-fit">
        <button
          v-for="t in tabs"
          :key="t.key"
          @click="activeTab = t.key"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors"
          :class="activeTab === t.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'"
        >
          <i :class="['pi', t.icon]" />
          {{ t.label }}
        </button>
      </div>

      <div class="lg:col-span-3 space-y-6">
        <!-- Thông tin tài khoản -->
        <div v-if="activeTab === 'profile'" class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Thông tin cá nhân</h2>
          <div class="flex items-center gap-4 mb-6">
            <Avatar label="MN" shape="circle" size="xlarge" class="bg-emerald-100 text-emerald-700" />
            <Button label="Thay đổi ảnh" outlined size="small" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-slate-600">Họ và tên</label>
              <InputText v-model="profile.fullName" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Email</label>
              <InputText v-model="profile.email" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Số điện thoại</label>
              <InputText v-model="profile.phone" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Vai trò</label>
              <InputText v-model="profile.role" disabled class="w-full mt-1" />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <Button label="Hủy" text />
            <Button label="Lưu thay đổi" severity="success" />
          </div>
        </div>

        <!-- Quản lý team -->
        <div v-if="activeTab === 'team'" class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Quản lý team</h2>
          <DataTable :value="team" size="small" stripedRows>
            <Column header="Tên">
              <template #body="{ data }">
                <div class="flex items-center gap-2">
                  <Avatar :label="data.name[0]" shape="circle" class="bg-emerald-100 text-emerald-700" />
                  <span>{{ data.name }}</span>
                </div>
              </template>
            </Column>
            <Column field="email" header="Email" />
            <Column field="role" header="Vai trò" />
            <Column header="Hành động">
              <template #body="{ data }">
                <Button label="Chỉ định campaign được xem" size="small" outlined @click="openAssign(data)" />
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- Thông báo -->
        <div v-if="activeTab === 'notifications'" class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Thông báo</h2>
          <div class="space-y-3">
            <label v-for="n in notificationOpts" :key="n.key" class="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <p class="font-medium text-slate-900">{{ n.label }}</p>
                <p class="text-xs text-slate-500">{{ n.desc }}</p>
              </div>
              <input type="checkbox" v-model="n.enabled" class="w-5 h-5 accent-emerald-500" />
            </label>
          </div>
        </div>

        <!-- Tích hợp -->
        <div v-if="activeTab === 'integrations'" class="space-y-6">
          <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
            <h2 class="text-base font-semibold text-slate-900 mb-4">Kết nối Bitrix24</h2>
            <Bitrix24Configurator
              :initial-state="integrationsState?.bitrix24 || {}"
              @update:state="reloadIntegrations"
            />
          </div>

          <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
            <h2 class="text-base font-semibold text-slate-900 mb-4">Cấu hình API</h2>
            <div class="space-y-4">
              <div>
                <label class="text-xs font-medium text-slate-600">Facebook API Access Token</label>
                <InputText v-model="integration.fbToken" class="w-full mt-1" placeholder="EAAB..." />
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Facebook Ad Account ID</label>
                <InputText v-model="integration.fbAdAccount" class="w-full mt-1" placeholder="act_123456789" />
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Google Sheet ID (demo data)</label>
                <InputText v-model="integration.sheetId" class="w-full mt-1" placeholder="1A2B3C..." />
              </div>
              <div class="flex justify-end">
                <Button label="Lưu cấu hình" severity="success" @click="saveIntegration" />
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-slate-200">
              <h3 class="text-sm font-semibold text-slate-900 mb-3">Hoặc import từ CSV Facebook Ads</h3>
              <FacebookCsvImporter :account-id="currentFbAccount?.id" />
            </div>
          </div>

          <div class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
            <h2 class="text-base font-semibold text-slate-900 mb-4">Tích hợp quảng cáo</h2>
            <div class="space-y-3">
              <div v-for="p in providers" :key="p.name" class="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div class="flex items-center gap-3">
                  <ChannelChip :channel="p.key" />
                  <span class="font-medium text-slate-900">{{ p.name }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs px-2 py-0.5 rounded-full" :class="p.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'">
                    {{ p.connected ? 'Đã kết nối' : 'Chưa kết nối' }}
                  </span>
                  <Button :label="p.connected ? 'Ngắt kết nối' : 'Kết nối'" :severity="p.connected ? 'danger' : 'success'" size="small" outlined @click="p.connected = !p.connected" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bảo mật -->
        <div v-if="activeTab === 'security'" class="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Bảo mật</h2>
          <div class="space-y-4">
            <div>
              <label class="text-xs font-medium text-slate-600">Mật khẩu hiện tại</label>
              <InputText type="password" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Mật khẩu mới</label>
              <InputText type="password" class="w-full mt-1" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Xác nhận mật khẩu</label>
              <InputText type="password" class="w-full mt-1" />
            </div>
            <Button label="Cập nhật mật khẩu" severity="success" />
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="assignDialog" :header="`Chỉ định campaign - ${assignTarget?.name || ''}`" modal :style="{ width: '480px' }">
      <div class="space-y-2 max-h-96 overflow-y-auto">
        <label v-for="c in campaignList" :key="c.id || c" class="flex items-center gap-2 p-2 rounded hover:bg-slate-50">
          <input type="checkbox" :value="c.id || c" v-model="selectedCampaignIds" class="accent-emerald-500" />
          <span class="text-sm">{{ c.name || c }}</span>
        </label>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="assignDialog = false" />
        <Button label="Lưu" severity="success" @click="saveAssign" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Avatar from 'primevue/avatar'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import ChannelChip from '../components/ui/ChannelChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import FacebookCsvImporter from '../components/settings/FacebookCsvImporter.vue'
import Bitrix24Configurator from '../components/settings/Bitrix24Configurator.vue'
import { useAuthStore } from '../stores/auth'
import {
  fetchAdminUsers,
  fetchSettingsIntegrations,
  saveFacebookIntegration,
  saveSheetIntegration,
  fetchMergedCampaigns,
  bulkAssignCampaigns,
} from '../lib/api'

const toast = useToast()
const authStore = useAuthStore()
const usingMock = ref(false)

const tabs = [
  { key: 'profile', label: 'Thông tin tài khoản', icon: 'pi-user' },
  { key: 'team', label: 'Quản lý team', icon: 'pi-users' },
  { key: 'notifications', label: 'Thông báo', icon: 'pi-bell' },
  { key: 'integrations', label: 'Tích hợp', icon: 'pi-link' },
  { key: 'security', label: 'Bảo mật', icon: 'pi-shield' },
]
const activeTab = ref('profile')

const profile = ref({
  fullName: authStore.username || 'Marketing Nam',
  email: authStore.email || 'mn@smartland.vn',
  phone: '0901 234 567',
  role: authStore.role || 'Marketing Manager',
})

const MOCK_TEAM = [
  { id: 'u1', name: 'Nguyễn Văn A', email: 'a@smartland.vn', role: 'MKT Lead' },
  { id: 'u2', name: 'Trần Thị B', email: 'b@smartland.vn', role: 'MKT Specialist' },
  { id: 'u3', name: 'Lê Văn C', email: 'c@smartland.vn', role: 'MKT Specialist' },
]
const team = ref(MOCK_TEAM)

const notificationOpts = ref([
  { key: 'lead', label: 'Lead mới', desc: 'Thông báo khi có lead mới', enabled: true },
  { key: 'campaign', label: 'Cảnh báo campaign', desc: 'CPL vượt ngưỡng', enabled: true },
  { key: 'report', label: 'Báo cáo hàng tuần', desc: 'Email tổng hợp mỗi thứ 2', enabled: false },
])

const integration = ref({ fbToken: '', fbAdAccount: '', sheetId: '' })
const currentFbAccount = ref(null)
const integrationsState = ref(null)

async function reloadIntegrations() {
  try {
    const { data } = await fetchSettingsIntegrations()
    const cfg = data?.data || data
    if (cfg) {
      integrationsState.value = cfg
      integration.value.fbToken = cfg.facebook?.access_token || ''
      integration.value.fbAdAccount = cfg.facebook?.ad_account_id || ''
      integration.value.sheetId = cfg.google_sheet?.sheet_id || ''
      currentFbAccount.value = cfg.facebook?.account || cfg.facebook || null
      if (Array.isArray(cfg.providers)) providers.value = cfg.providers
    }
  } catch (e) {
    console.warn('[settings] integrations reload failed:', e.message)
  }
}
async function saveIntegration() {
  let okFb = false
  let okSheet = false
  try {
    if (integration.value.fbToken || integration.value.fbAdAccount) {
      await saveFacebookIntegration({
        access_token: integration.value.fbToken,
        ad_account_id: integration.value.fbAdAccount,
      })
      okFb = true
    }
    if (integration.value.sheetId) {
      await saveSheetIntegration({ sheet_id: integration.value.sheetId })
      okSheet = true
    }
    toast.add({ severity: 'success', summary: 'Đã lưu', detail: `Cấu hình ${okFb ? 'Facebook' : ''}${okFb && okSheet ? ' + ' : ''}${okSheet ? 'Google Sheet' : ''} đã được lưu`, life: 3000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi lưu cấu hình', detail: e.response?.data?.detail || e.message, life: 4000 })
  }
}

const providers = ref([
  { key: 'facebook', name: 'Facebook Ads', connected: true },
  { key: 'google', name: 'Google Ads', connected: false },
  { key: 'tiktok', name: 'TikTok Ads', connected: false },
  { key: 'zalo', name: 'Zalo Ads', connected: false },
  { key: 'youtube', name: 'YouTube Ads', connected: false },
])

const assignDialog = ref(false)
const assignTarget = ref(null)
const MOCK_CAMPAIGNS = [
  { id: 'c1', name: 'VHGP - Lead Form Q4' },
  { id: 'c2', name: 'MW - Carousel' },
  { id: 'c3', name: 'EGS - Search' },
  { id: 'c4', name: 'SSC - Zalo Form' },
]
const campaignList = ref(MOCK_CAMPAIGNS)
const selectedCampaignIds = ref([])

async function openAssign(user) {
  assignTarget.value = user
  selectedCampaignIds.value = []
  assignDialog.value = true
  try {
    const { data } = await fetchMergedCampaigns()
    const rows = data?.data || data
    if (Array.isArray(rows) && rows.length) {
      campaignList.value = rows.map((c) => ({ id: c.id || c.campaign_id, name: c.name || c.campaign_name }))
    }
  } catch (e) {
    console.warn('[settings] campaign list fallback:', e.message)
  }
}

async function saveAssign() {
  if (!assignTarget.value) return
  try {
    await bulkAssignCampaigns(assignTarget.value.id, selectedCampaignIds.value)
    toast.add({ severity: 'success', summary: 'Đã gán', detail: `Đã chỉ định ${selectedCampaignIds.value.length} campaign`, life: 3000 })
    assignDialog.value = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi gán campaign', detail: e.response?.data?.detail || e.message, life: 4000 })
  }
}

onMounted(async () => {
  let mockUsed = false
  try {
    const { data } = await fetchAdminUsers()
    const rows = data?.data || data
    if (Array.isArray(rows) && rows.length) team.value = rows
    else mockUsed = true
  } catch (e) {
    mockUsed = true
    console.warn('[settings] users fallback:', e.message)
  }
  try {
    const { data } = await fetchSettingsIntegrations()
    const cfg = data?.data || data
    if (cfg) {
      integrationsState.value = cfg
      integration.value.fbToken = cfg.facebook?.access_token || ''
      integration.value.fbAdAccount = cfg.facebook?.ad_account_id || ''
      integration.value.sheetId = cfg.google_sheet?.sheet_id || ''
      currentFbAccount.value = cfg.facebook?.account || cfg.facebook || null
      if (Array.isArray(cfg.providers)) providers.value = cfg.providers
    }
  } catch (e) {
    mockUsed = true
    console.warn('[settings] integrations fallback:', e.message)
  }
  usingMock.value = mockUsed
})
</script>

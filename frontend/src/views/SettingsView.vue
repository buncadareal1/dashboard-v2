<template>
  <div class="space-y-8 fade-in-animation max-w-4xl">
    <!-- HEADER -->
    <div>
      <p class="font-black text-primary text-xs uppercase tracking-[0.3em] mb-1">Cấu hình</p>
      <h2 class="text-3xl font-headline font-black text-on-surface tracking-tight">Cài đặt</h2>
    </div>

    <!-- CRM WEBHOOK -->
    <section class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-tertiary/10 text-tertiary">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">webhook</span>
        </div>
        <div>
          <h3 class="text-lg font-headline font-bold text-on-surface">CRM Webhook</h3>
          <p class="text-xs text-on-surface-variant font-medium">Cấu hình webhook Bitrix24 để đồng bộ khách hàng</p>
        </div>
      </div>
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Webhook URL</label>
          <input v-model="webhookUrl" type="text" placeholder="https://your-domain.bitrix24.vn/rest/1/xxxxx/" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-mono transition-all" />
        </div>
        <div class="flex items-center gap-4">
          <button @click="testWebhook" :disabled="!webhookUrl" class="bg-surface-container hover:bg-surface-container-high text-on-surface px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border border-slate-200">
            <span class="material-symbols-outlined text-[16px]">science</span> Kiểm tra kết nối
          </button>
          <button @click="saveWebhook" :disabled="!webhookUrl" class="bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all">
            Lưu Webhook
          </button>
        </div>
      </div>
    </section>

    <!-- FIELD MAPPING -->
    <section class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">swap_horiz</span>
          </div>
          <div>
            <h3 class="text-lg font-headline font-bold text-on-surface">Ánh xạ trường dữ liệu</h3>
            <p class="text-xs text-on-surface-variant font-medium">Ánh xạ trường dữ liệu từ Facebook Lead Ads sang Bitrix24 CRM</p>
          </div>
        </div>
        <button @click="addMapping" class="bg-surface-container hover:bg-surface-container-high px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-slate-200 transition-all">
          <span class="material-symbols-outlined text-[16px]">add</span> Thêm trường
        </button>
      </div>

      <div class="space-y-3">
        <div v-for="(field, index) in fieldMappings" :key="index" class="flex items-center gap-4 p-4 bg-surface rounded-xl border border-slate-200 group">
          <div class="flex-1">
            <p class="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Trường Facebook</p>
            <input v-model="field.fbField" type="text" placeholder="VD: full_name" class="w-full bg-surface-container-lowest p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <span class="material-symbols-outlined text-outline-variant mt-4">arrow_forward</span>
          <div class="flex-1">
            <p class="text-[10px] font-bold text-tertiary uppercase tracking-widest mb-1">Trường Bitrix24</p>
            <select v-model="field.crmField" class="w-full bg-surface-container-lowest p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 font-bold">
              <option value="">-- Chọn --</option>
              <option v-for="opt in crmFieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <button @click="removeMapping(index)" class="p-2 mt-4 opacity-0 group-hover:opacity-100 hover:bg-error/10 rounded-lg transition-all">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error">close</span>
          </button>
        </div>
      </div>

      <button @click="saveMapping" class="mt-6 bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all">
        Lưu ánh xạ
      </button>
    </section>

    <!-- NOTIFICATION SETTINGS -->
    <section class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary-fixed text-secondary">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">notifications</span>
        </div>
        <div>
          <h3 class="text-lg font-headline font-bold text-on-surface">Thông báo</h3>
          <p class="text-xs text-on-surface-variant font-medium">Cấu hình cách nhận cảnh báo</p>
        </div>
      </div>
      <div class="space-y-4">
        <div v-for="n in notifications" :key="n.key" class="flex items-center justify-between p-4 bg-surface rounded-xl border border-slate-200">
          <div>
            <p class="text-sm font-bold text-on-surface">{{ n.label }}</p>
            <p class="text-xs text-on-surface-variant mt-0.5">{{ n.description }}</p>
          </div>
          <InputSwitch v-model="n.enabled" />
        </div>
      </div>
    </section>

    <!-- CHANGE PASSWORD -->
    <section class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-error/10 text-error">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">lock</span>
        </div>
        <div>
          <h3 class="text-lg font-headline font-bold text-on-surface">Đổi mật khẩu</h3>
          <p class="text-xs text-on-surface-variant font-medium">Cập nhật mật khẩu tài khoản</p>
        </div>
      </div>
      <div class="space-y-4 max-w-md">
        <div class="space-y-2">
          <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Mật khẩu hiện tại</label>
          <input v-model="passwordForm.current" type="password" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all" />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Mật khẩu mới</label>
          <input v-model="passwordForm.newPass" type="password" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all" />
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Xác nhận mật khẩu mới</label>
          <input v-model="passwordForm.confirm" type="password" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all" />
        </div>
        <button @click="changePassword" class="bg-error/10 border border-error/30 text-black hover:bg-error/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all">
          Cập nhật mật khẩu
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'

import InputSwitch from 'primevue/inputswitch'
import api from '../lib/axios'

const toast = useToast()


// CRM Webhook
const webhookUrl = ref('')

onMounted(async () => {
  try {
    const response = await api.get('/settings')
    const settings = response.data.data || response.data
    if (settings.webhook_url) {
      webhookUrl.value = settings.webhook_url
    }
    if (settings.field_mappings) {
      try {
        const parsed = typeof settings.field_mappings === 'string' ? JSON.parse(settings.field_mappings) : settings.field_mappings
        if (Array.isArray(parsed) && parsed.length > 0) {
          fieldMappings.value = parsed
        }
      } catch (e) {
        console.error('Failed to parse field_mappings:', e)
      }
    }
  } catch (e) {
    console.error('Failed to fetch settings:', e)
  }
})

const testWebhook = async () => {
  if (!webhookUrl.value) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng nhập URL webhook trước.', life: 3000 })
    return
  }
  // Lưu trước rồi test
  try {
    await api.put('/settings', { settings: { webhook_url: webhookUrl.value } })
    toast.add({ severity: 'info', summary: 'Đang kiểm tra...', detail: 'Đang kết nối tới Bitrix24...', life: 3000 })
    const res = await api.post('/bitrix24/test')
    if (res.data.success) {
      toast.add({ severity: 'success', summary: 'Thành công', detail: res.data.message, life: 4000 })
    } else {
      toast.add({ severity: 'error', summary: 'Thất bại', detail: res.data.error, life: 5000 })
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể kết nối.', life: 5000 })
  }
}

const saveWebhook = async () => {
  try {
    await api.put('/settings', { settings: { webhook_url: webhookUrl.value } })
    toast.add({ severity: 'success', summary: 'Đã lưu', detail: 'Đã lưu URL Webhook vào cấu hình.', life: 3000 })
  } catch (e) {
    console.error('Failed to save webhook:', e)
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể lưu webhook.', life: 4000 })
  }
}

// Field Mapping
const crmFieldOptions = ref([
  { value: 'NAME', label: 'NAME (Họ tên)' },
  { value: 'PHONE_WORK', label: 'PHONE_WORK' },
  { value: 'PHONE_MOBILE', label: 'PHONE_MOBILE' },
  { value: 'EMAIL_WORK', label: 'EMAIL_WORK' },
  { value: 'UTM_CAMPAIGN', label: 'UTM_CAMPAIGN' },
  { value: 'UTM_SOURCE', label: 'UTM_SOURCE' },
  { value: 'UTM_MEDIUM', label: 'UTM_MEDIUM' },
  { value: 'COMMENTS', label: 'COMMENTS' },
  { value: 'SOURCE_ID', label: 'SOURCE_ID' },
  { value: 'TITLE', label: 'TITLE' },
])

const fieldMappings = ref([
  { fbField: 'full_name', crmField: 'NAME' },
  { fbField: 'phone_number', crmField: 'PHONE_WORK' },
  { fbField: 'campaign_name', crmField: 'UTM_CAMPAIGN' },
  { fbField: 'ad_id', crmField: 'COMMENTS' },
])

const addMapping = () => {
  fieldMappings.value.push({ fbField: '', crmField: '' })
}

const removeMapping = (index) => {
  fieldMappings.value.splice(index, 1)
}

const saveMapping = async () => {
  try {
    await api.put('/settings', { settings: { field_mappings: JSON.stringify(fieldMappings.value) } })
    toast.add({ severity: 'success', summary: 'Đã lưu ánh xạ', detail: 'Cấu hình ánh xạ trường dữ liệu đã cập nhật.', life: 3000 })
  } catch (e) {
    console.error('Failed to save field mappings:', e)
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể lưu ánh xạ.', life: 4000 })
  }
}

// Notifications
const notifications = ref([
  { key: 'new_lead', label: 'Cảnh báo khách hàng mới', description: 'Nhận thông báo khi có khách hàng mới trong CRM', enabled: true },
  { key: 'budget_alert', label: 'Cảnh báo ngân sách', description: 'Cảnh báo khi chi tiêu vượt ngân sách hàng ngày', enabled: true },
  { key: 'ai_action', label: 'Quy tắc AI thực thi', description: 'Thông báo khi AI tự động can thiệp chiến dịch', enabled: false },
  { key: 'report_ready', label: 'Báo cáo tuần', description: 'Thông báo qua email khi báo cáo tuần được tạo', enabled: false },
])

// Password
const passwordForm = ref({ current: '', newPass: '', confirm: '' })

const changePassword = async () => {
  if (!passwordForm.value.current || !passwordForm.value.newPass) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng điền đầy đủ thông tin.', life: 3000 })
    return
  }
  if (passwordForm.value.newPass !== passwordForm.value.confirm) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Mật khẩu mới và xác nhận không khớp.', life: 3000 })
    return
  }
  if (passwordForm.value.newPass.length < 6) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Mật khẩu phải có ít nhất 6 ký tự.', life: 3000 })
    return
  }
  try {
    await api.put('/change-password', {
      current_password: passwordForm.value.current,
      new_password: passwordForm.value.newPass
    })
    toast.add({ severity: 'success', summary: 'Đã cập nhật', detail: 'Đổi mật khẩu thành công.', life: 3000 })
    passwordForm.value = { current: '', newPass: '', confirm: '' }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể đổi mật khẩu.', life: 4000 })
  }
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

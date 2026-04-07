<template>
  <div class="bg-white rounded-lg p-5 border border-gray-200">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900">Bitrix24 CRM</h3>
        <p class="text-xs text-slate-500 mt-1">
          Đồng bộ leads từ Bitrix24 CRM để theo dõi tỷ lệ win của campaign Facebook
        </p>
      </div>
      <span
        class="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap"
        :class="pillClass"
      >
        {{ pillLabel }}
      </span>
    </div>

    <div class="mt-4">
      <label class="text-xs font-medium text-slate-600">Webhook URL</label>
      <input
        v-model="webhookInput"
        type="text"
        class="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder="https://your-portal.bitrix24.vn/rest/USER_ID/SECRET/"
        :disabled="loading"
      />
      <p v-if="currentMasked" class="text-xs text-slate-500 mt-1">
        Hiện tại: {{ currentMasked }}
      </p>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        :disabled="!webhookInput.trim() || loading"
        @click="onSave"
      >
        Lưu webhook
      </button>
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!canTest || loading"
        @click="onTest"
      >
        Test kết nối
      </button>
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading"
        @click="onSync"
      >
        Đồng bộ leads ngay
      </button>
    </div>

    <div
      v-if="lastTestMessage"
      class="mt-4 p-3 rounded-md text-xs"
      :class="lastTestOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
    >
      {{ lastTestMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import {
  saveBitrix24Integration,
  testBitrix24Connection,
  syncBitrix24LeadsNow,
} from '../../lib/api'

const props = defineProps({
  initialState: {
    type: Object,
    default: () => ({}),
  },
})
const emit = defineEmits(['update:state'])
const toast = useToast()

const webhookInput = ref('')
const loading = ref(false)
const currentMasked = ref(props.initialState?.webhook_url_masked || '')
const connected = ref(!!props.initialState?.connected)
const lastTestOk = ref(
  props.initialState?.last_test_ok ?? null,
)
const lastTestMessage = ref('')

const canTest = computed(() => connected.value)

const pillLabel = computed(() => {
  if (lastTestOk.value === false) return 'Lỗi'
  if (connected.value) return 'Đã kết nối'
  return 'Chưa kết nối'
})
const pillClass = computed(() => {
  if (lastTestOk.value === false) return 'bg-rose-50 text-rose-700'
  if (connected.value) return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
})

function errorDetail(e) {
  return e?.response?.data?.detail || e?.message || 'Đã có lỗi xảy ra'
}

async function onSave() {
  const url = webhookInput.value.trim()
  if (!url) return
  loading.value = true
  try {
    const { data } = await saveBitrix24Integration(url)
    currentMasked.value = data?.webhook_url_masked || currentMasked.value
    connected.value = true
    lastTestOk.value = !!data?.validated
    lastTestMessage.value = data?.validated
      ? 'Đã lưu và xác thực kết nối Bitrix24 thành công.'
      : 'Đã lưu webhook nhưng chưa xác thực được kết nối.'
    webhookInput.value = ''
    toast.add({
      severity: 'success',
      summary: 'Đã lưu',
      detail: 'Cấu hình Bitrix24 đã được lưu',
      life: 3000,
    })
    emit('update:state')
  } catch (e) {
    lastTestOk.value = false
    lastTestMessage.value = errorDetail(e)
    toast.add({
      severity: 'error',
      summary: 'Lỗi lưu Bitrix24',
      detail: errorDetail(e),
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function onTest() {
  loading.value = true
  try {
    const { data } = await testBitrix24Connection()
    lastTestOk.value = !!data?.ok
    lastTestMessage.value = data?.message || (data?.ok ? 'Thành công' : 'Thất bại')
    toast.add({
      severity: data?.ok ? 'success' : 'error',
      summary: data?.ok ? 'Kết nối OK' : 'Kết nối lỗi',
      detail: lastTestMessage.value,
      life: 3000,
    })
  } catch (e) {
    lastTestOk.value = false
    lastTestMessage.value = errorDetail(e)
    toast.add({
      severity: 'error',
      summary: 'Lỗi test Bitrix24',
      detail: errorDetail(e),
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function onSync() {
  loading.value = true
  try {
    const { data } = await syncBitrix24LeadsNow()
    const payload = data?.data || data || {}
    const count = payload.total ?? (Array.isArray(payload.leads) ? payload.leads.length : 0)
    toast.add({
      severity: 'success',
      summary: 'Đồng bộ Bitrix24',
      detail: `Đã đồng bộ ${count} leads từ Bitrix24`,
      life: 3000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi đồng bộ',
      detail: errorDetail(e),
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}
</script>

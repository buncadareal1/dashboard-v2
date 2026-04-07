<template>
  <div class="space-y-4">
    <!-- Step 1: file picker -->
    <div v-if="step === 1">
      <div
        class="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
        @click="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <i class="pi pi-cloud-upload text-3xl text-slate-400" />
        <p class="mt-2 text-sm text-slate-600">Kéo thả file CSV vào đây hoặc bấm để chọn</p>
        <p class="text-xs text-slate-400 mt-1">Tối đa 10 MB · định dạng .csv</p>
        <input
          ref="fileInput"
          type="file"
          accept=".csv"
          class="hidden"
          @change="onPick"
        />
      </div>
      <div v-if="file" class="mt-3 flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
        <div class="flex items-center gap-2">
          <i class="pi pi-file text-emerald-600" />
          <span class="text-sm font-medium text-slate-800">{{ file.name }}</span>
          <span class="text-xs text-slate-500">({{ formatSize(file.size) }})</span>
        </div>
        <Button icon="pi pi-times" text rounded size="small" @click="file = null" />
      </div>
      <div class="flex justify-end mt-4">
        <Button label="Xem trước" severity="success" :disabled="!file || loading" :loading="loading" @click="doPreview" />
      </div>
    </div>

    <!-- Step 2: preview -->
    <div v-else-if="step === 2 && previewData" class="space-y-4">
      <div class="flex items-center gap-4 text-sm text-slate-700">
        <Tag :value="`${previewData.row_count} dòng`" severity="info" />
        <Tag :value="`${(previewData.headers || []).length} cột`" severity="info" />
        <Tag :value="`${(previewData.mapped_fields ? Object.keys(previewData.mapped_fields).length : 0)} cột nhận diện được`" severity="success" />
      </div>

      <div class="border border-slate-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="text-left px-3 py-2 font-medium">Cột Facebook</th>
              <th class="text-left px-3 py-2 font-medium">Trường hệ thống</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in previewData.headers" :key="h" class="border-t border-slate-100">
              <td class="px-3 py-2 text-slate-800">{{ h }}</td>
              <td class="px-3 py-2">
                <span v-if="previewData.mapped_fields?.[h]" class="text-emerald-700 inline-flex items-center gap-1">
                  <i class="pi pi-check-circle" /> {{ previewData.mapped_fields[h] }}
                </span>
                <span v-else class="text-slate-400 inline-flex items-center gap-1">
                  <i class="pi pi-minus" /> Không nhận diện
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="previewData.missing_required?.length" class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <p class="font-medium">Thiếu cột bắt buộc</p>
        <p class="mt-1">Cần cột: {{ previewData.missing_required.join(', ') }}</p>
      </div>

      <details v-if="previewData.errors?.length" class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
        <summary class="cursor-pointer font-medium">{{ previewData.errors.length }} lỗi parse — xem chi tiết</summary>
        <ul class="mt-2 list-disc list-inside space-y-1">
          <li v-for="(e, i) in previewData.errors" :key="i">{{ e }}</li>
        </ul>
      </details>

      <div v-if="previewData.sample_rows?.length" class="border border-slate-200 rounded-lg overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th v-for="f in mappedFieldList" :key="f" class="text-left px-3 py-2 font-medium whitespace-nowrap">{{ f }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in previewData.sample_rows.slice(0, 10)" :key="i" class="border-t border-slate-100">
              <td v-for="f in mappedFieldList" :key="f" class="px-3 py-2 whitespace-nowrap text-slate-700">{{ row[f] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between">
        <Button label="Quay lại" text @click="reset" />
        <Button
          label="Nhập vào hệ thống"
          severity="success"
          :disabled="(previewData.missing_required?.length || 0) > 0 || loading"
          :loading="loading"
          @click="doImport"
        />
      </div>
    </div>

    <!-- Step 3: result -->
    <div v-else-if="step === 3">
      <div v-if="loading" class="p-6 text-center text-slate-600">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-600" />
        <p class="mt-2 text-sm">Đang import...</p>
      </div>
      <div v-else-if="importData" class="p-6 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
        <i class="pi pi-check-circle text-4xl text-emerald-600" />
        <h3 class="mt-2 text-lg font-semibold text-emerald-800">Import thành công!</h3>
        <p class="text-sm text-emerald-700 mt-1">
          Đã tạo mới: {{ importData.created ?? 0 }} · Đã cập nhật: {{ importData.updated ?? 0 }} · Bỏ qua: {{ importData.skipped ?? 0 }}
        </p>
        <details v-if="importData.errors?.length" class="mt-3 text-left text-sm text-amber-800">
          <summary class="cursor-pointer font-medium">{{ importData.errors.length }} cảnh báo — xem chi tiết</summary>
          <ul class="mt-2 list-disc list-inside space-y-1">
            <li v-for="(e, i) in importData.errors" :key="i">{{ e }}</li>
          </ul>
        </details>
        <div class="mt-4">
          <Button label="Import file khác" severity="success" outlined @click="reset" />
        </div>
      </div>
      <div v-else-if="error" class="p-6 rounded-lg bg-rose-50 border border-rose-200 text-center">
        <i class="pi pi-times-circle text-4xl text-rose-600" />
        <h3 class="mt-2 text-lg font-semibold text-rose-800">Import thất bại</h3>
        <p class="text-sm text-rose-700 mt-1">{{ error }}</p>
        <div class="mt-4 flex justify-center gap-2">
          <Button label="Quay lại" text @click="step = 2" />
          <Button label="Thử lại" severity="success" @click="doImport" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { previewFacebookCsv, importFacebookCsv } from '../../lib/api'

const props = defineProps({
  accountId: { type: [Number, String], default: null },
})

const toast = useToast()
const step = ref(1)
const file = ref(null)
const previewData = ref(null)
const importData = ref(null)
const loading = ref(false)
const error = ref(null)
const fileInput = ref(null)

const MAX_SIZE = 10 * 1024 * 1024

const mappedFieldList = computed(() => {
  const m = previewData.value?.mapped_fields || {}
  return [...new Set(Object.values(m))]
})

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function validateFile(f) {
  if (!f) return false
  if (!/\.csv$/i.test(f.name)) {
    toast.add({ severity: 'error', summary: 'Sai định dạng', detail: 'Chỉ chấp nhận file .csv', life: 3500 })
    return false
  }
  if (f.size > MAX_SIZE) {
    toast.add({ severity: 'error', summary: 'File quá lớn', detail: 'Kích thước tối đa 10 MB', life: 3500 })
    return false
  }
  return true
}

function onPick(e) {
  const f = e.target.files?.[0]
  if (f && validateFile(f)) file.value = f
  if (e.target) e.target.value = ''
}

function onDrop(e) {
  const f = e.dataTransfer?.files?.[0]
  if (f && validateFile(f)) file.value = f
}

async function doPreview() {
  if (!file.value) return
  loading.value = true
  error.value = null
  try {
    const { data } = await previewFacebookCsv(file.value)
    previewData.value = data?.data || data
    step.value = 2
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi xem trước', detail: e.response?.data?.detail || e.message, life: 4000 })
  } finally {
    loading.value = false
  }
}

async function doImport() {
  if (!file.value) return
  loading.value = true
  error.value = null
  importData.value = null
  step.value = 3
  try {
    const { data } = await importFacebookCsv(file.value, props.accountId ?? undefined)
    importData.value = data?.data || data
    toast.add({ severity: 'success', summary: 'Import thành công', detail: `Tạo mới ${importData.value.created ?? 0}, cập nhật ${importData.value.updated ?? 0}`, life: 3500 })
  } catch (e) {
    error.value = e.response?.data?.detail || e.message
  } finally {
    loading.value = false
  }
}

function reset() {
  step.value = 1
  file.value = null
  previewData.value = null
  importData.value = null
  error.value = null
  loading.value = false
}
</script>

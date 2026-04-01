<template>
  <div class="space-y-8 fade-in-animation">
    <!-- HEADER -->
    <div class="bg-surface-container-lowest p-10 rounded-2xl relative overflow-hidden border border-slate-200 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
       <div>
         <p class="text-xs font-bold text-primary mb-2 flex gap-1 items-center uppercase tracking-widest">
           <span class="material-symbols-outlined text-[16px] animate-pulse" style="font-variation-settings: 'FILL' 1;">psychology</span> Quy tắc AI
         </p>
         <h2 class="text-4xl font-headline font-black text-on-surface tracking-tight mb-2">Trợ lý tự động</h2>
         <p class="text-sm font-medium text-on-surface-variant max-w-lg leading-relaxed">
           Cấp quyền cho AI can thiệp chiến dịch để tối ưu CPL và tăng lợi nhuận tự động.
         </p>
       </div>

       <div class="flex items-center gap-4 bg-surface-container p-3 rounded-2xl border border-slate-200">
         <span class="text-[10px] font-bold px-2 text-on-surface-variant uppercase tracking-widest">Quan sát</span>
         <InputSwitch v-model="autoPilot" />
         <span :class="{'text-primary': autoPilot, 'opacity-50 text-on-surface-variant': !autoPilot}" class="text-[10px] font-black px-2 uppercase tracking-widest transition-colors">Tự động</span>
       </div>
    </div>

    <!-- RULES SECTION -->
    <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex justify-between items-center mb-8 border-b border-surface-container-high pb-4">
        <h3 class="text-xl font-headline font-bold text-on-surface">Danh sách quy tắc ({{ rules.length }})</h3>
        <button @click="openAddRule" class="bg-primary/10 border border-primary/30 text-black px-4 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 shadow-md hover:scale-105 transition-transform">
          <span class="material-symbols-outlined text-[16px]">add</span> Thêm quy tắc
        </button>
      </div>

      <div class="space-y-4">
        <div v-for="rule in rules" :key="rule.id" class="p-5 bg-surface-container hover:bg-surface-container-high transition-colors rounded-xl flex items-center justify-between border border-transparent hover:border-slate-200 group">
          <div class="flex-1">
            <p class="font-bold text-sm text-on-surface mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]" :class="rule.action === 'PAUSE' ? 'text-error' : 'text-primary'" :style="rule.action !== 'PAUSE' ? `font-variation-settings: 'FILL' 1` : ''">
                {{ rule.action === 'PAUSE' ? 'gpp_bad' : 'rocket_launch' }}
              </span>
              {{ rule.name }}
            </p>
            <p class="text-[11px] text-on-surface-variant font-mono bg-surface-container-lowest px-3 py-1.5 rounded-lg inline-block border border-slate-200 font-bold">
              IF {{ rule.metric }} {{ rule.operator }} {{ rule.threshold }} & Spend > ${{ rule.minSpend }} => {{ rule.action === 'PAUSE' ? 'TẠM_DỪNG' : `TĂNG_NGÂN_SÁCH ${rule.budgetIncrease}%` }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="editRule(rule)" class="p-2 opacity-0 group-hover:opacity-100 hover:bg-primary/10 rounded-lg transition-all">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
            </button>
            <button @click="confirmDeleteRule(rule)" class="p-2 opacity-0 group-hover:opacity-100 hover:bg-error/10 rounded-lg transition-all">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error">delete</span>
            </button>
            <InputSwitch v-model="rule.active" />
          </div>
        </div>

        <div v-if="rules.length === 0" class="text-center py-12">
          <span class="material-symbols-outlined text-4xl text-outline-variant/40">rule</span>
          <p class="text-sm font-bold text-on-surface-variant mt-2">Chưa có quy tắc nào</p>
          <p class="text-xs text-on-surface-variant mt-1">Tạo quy tắc tự động đầu tiên ở trên.</p>
        </div>
      </div>
    </div>

    <!-- EXECUTION LOG -->
    <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <h3 class="text-xl font-headline font-bold text-on-surface mb-6">Nhật ký thực thi</h3>
      <div class="space-y-3">
        <div v-for="log in executionLogs" :key="log.id" class="flex items-start gap-4 p-4 bg-surface rounded-xl border border-slate-200">
          <div class="w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
               :class="log.type === 'pause' ? 'bg-error/10 text-error' : log.type === 'scale' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'">
            <span class="material-symbols-outlined text-[16px]">{{ log.type === 'pause' ? 'pause_circle' : log.type === 'scale' ? 'trending_up' : 'info' }}</span>
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <p class="text-sm font-bold text-on-surface">{{ log.message }}</p>
              <span class="text-[10px] text-on-surface-variant font-mono">{{ log.timestamp }}</span>
            </div>
            <p class="text-xs text-on-surface-variant mt-1">{{ log.detail }}</p>
          </div>
        </div>
        <div v-if="executionLogs.length === 0" class="text-center py-8 text-on-surface-variant text-sm">Chưa có hoạt động. Bật chế độ tự động để bắt đầu.</div>
      </div>
    </div>

    <!-- ADD/EDIT RULE MODAL -->
    <div v-if="showRuleModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="closeRuleModal">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200">
        <div class="px-8 py-6 border-b border-slate-200 flex justify-between items-center">
          <h3 class="text-xl font-headline font-bold text-on-surface">{{ editingRule ? 'Sửa quy tắc' : 'Thêm quy tắc' }}</h3>
          <button @click="closeRuleModal" class="p-1 hover:bg-surface-container rounded-lg"><span class="material-symbols-outlined text-on-surface-variant">close</span></button>
        </div>
        <div class="p-8 space-y-5">
          <div class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tên quy tắc</label>
            <input v-model="ruleForm.name" type="text" placeholder="VD: Tự động tắt CPL cao" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Chỉ số</label>
              <select v-model="ruleForm.metric" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm">
                <option value="CPL">CPL</option>
                <option value="ROAS">ROAS</option>
                <option value="CTR">CTR</option>
                <option value="CPC">CPC</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Điều kiện</label>
              <select v-model="ruleForm.operator" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm">
                <option value=">">Lớn hơn (>)</option>
                <option value="<">Nhỏ hơn (<)</option>
                <option value=">=">Lớn hơn hoặc bằng (>=)</option>
                <option value="<=">Nhỏ hơn hoặc bằng (<=)</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Ngưỡng</label>
              <input v-model="ruleForm.threshold" type="text" placeholder="VD: $15.00 hoặc 3.0" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm font-mono" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Chi tiêu tối thiểu ($)</label>
              <input v-model.number="ruleForm.minSpend" type="number" placeholder="50" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm font-mono" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Hành động</label>
            <select v-model="ruleForm.action" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm">
              <option value="PAUSE">Tạm dừng chiến dịch</option>
              <option value="SCALE">Tăng ngân sách</option>
            </select>
          </div>
          <div v-if="ruleForm.action === 'SCALE'" class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tăng ngân sách (%)</label>
            <input v-model.number="ruleForm.budgetIncrease" type="number" placeholder="20" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none text-sm font-mono" />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button @click="closeRuleModal" class="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest">Hủy</button>
          <button @click="saveRule" class="bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all">
            {{ editingRule ? 'Cập nhật' : 'Tạo quy tắc' }}
          </button>
        </div>
      </div>
    </div>

    <!-- DELETE CONFIRM -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showDeleteModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center space-y-4 border border-slate-200">
        <div class="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-error text-3xl">warning</span>
        </div>
        <h3 class="text-xl font-headline font-bold text-on-surface">Xóa quy tắc</h3>
        <p class="text-sm text-on-surface-variant">Xóa <span class="font-bold">{{ deleteTarget?.name }}</span>?</p>
        <div class="flex justify-center gap-3 pt-2">
          <button @click="showDeleteModal = false" class="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest">Hủy</button>
          <button @click="deleteRule" class="bg-error/10 border border-error/30 text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Xóa</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useToast } from "primevue/usetoast"
import InputSwitch from 'primevue/inputswitch'
import api from '../lib/axios'

const toast = useToast()
const autoPilot = ref(false)

// Rules
const rules = ref([])

// Rule form
const showRuleModal = ref(false)
const editingRule = ref(null)
const ruleForm = ref({ name: '', metric: 'CPL', operator: '>', threshold: '', minSpend: 50, action: 'PAUSE', budgetIncrease: 20 })

const showDeleteModal = ref(false)
const deleteTarget = ref(null)

// Execution log
const executionLogs = ref([
  { id: 1, type: 'pause', message: 'Đã tạm dừng chiến dịch "FB Lead Gen 03"', detail: 'CPL vượt ngưỡng $15.00 với chi tiêu $72.', timestamp: '2024-10-28 14:32' },
  { id: 2, type: 'scale', message: 'Đã tăng ngân sách "FB Conv 01"', detail: 'ROAS 4.2x kích hoạt tăng 20% ngân sách ($50 -> $60).', timestamp: '2024-10-28 11:15' },
  { id: 3, type: 'info', message: 'Hoàn tất quét chiến dịch', detail: '12 chiến dịch đã đánh giá. 2 hành động được thực thi.', timestamp: '2024-10-28 10:00' },
])

onMounted(async () => {
  try {
    const response = await api.get('/rules')
    rules.value = response.data
  } catch (e) {
    console.error('Failed to fetch rules:', e)
  }
})

const openAddRule = () => {
  editingRule.value = null
  ruleForm.value = { name: '', metric: 'CPL', operator: '>', threshold: '', minSpend: 50, action: 'PAUSE', budgetIncrease: 20 }
  showRuleModal.value = true
}

const editRule = (rule) => {
  editingRule.value = rule
  ruleForm.value = { ...rule }
  showRuleModal.value = true
}

const closeRuleModal = () => {
  showRuleModal.value = false
  editingRule.value = null
}

const saveRule = async () => {
  if (!ruleForm.value.name || !ruleForm.value.threshold) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng nhập tên và ngưỡng.', life: 3000 })
    return
  }
  try {
    if (editingRule.value) {
      const response = await api.put(`/rules/${editingRule.value.id}`, ruleForm.value)
      Object.assign(editingRule.value, response.data)
      toast.add({ severity: 'success', summary: 'Đã cập nhật', detail: `Quy tắc "${ruleForm.value.name}" đã cập nhật.`, life: 3000 })
    } else {
      const response = await api.post('/rules', ruleForm.value)
      rules.value.push(response.data)
      toast.add({ severity: 'success', summary: 'Đã tạo', detail: `Quy tắc "${ruleForm.value.name}" đã tạo.`, life: 3000 })
    }
    closeRuleModal()
  } catch (e) {
    console.error('Failed to save rule:', e)
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể lưu quy tắc.', life: 4000 })
  }
}

const confirmDeleteRule = (rule) => {
  deleteTarget.value = rule
  showDeleteModal.value = true
}

const deleteRule = async () => {
  try {
    await api.delete(`/rules/${deleteTarget.value.id}`)
    rules.value = rules.value.filter(r => r.id !== deleteTarget.value.id)
    toast.add({ severity: 'success', summary: 'Đã xóa', detail: `Quy tắc đã xóa.`, life: 3000 })
    showDeleteModal.value = false
  } catch (e) {
    console.error('Failed to delete rule:', e)
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể xóa quy tắc.', life: 4000 })
    showDeleteModal.value = false
  }
}

watch(autoPilot, (v) => {
  if (v) {
    toast.add({ severity: 'warn', summary: 'Đã kích hoạt AI!', detail: 'AI có toàn quyền can thiệp chiến dịch qua Meta API.', life: 5000 })
  } else {
    toast.add({ severity: 'info', summary: 'Chế độ an toàn', detail: 'AI đã chuyển về chế độ quan sát.', life: 3000 })
  }
})
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

<template>
  <div class="space-y-10 fade-in-animation">

    <header class="border-b border-surface-container-high pb-8">
       <nav class="flex items-center gap-2 mb-2">
         <span class="text-[11px] font-label font-bold text-on-surface-variant uppercase tracking-widest">Cài đặt</span>
         <span class="material-symbols-outlined text-[14px] text-on-surface-variant">chevron_right</span>
         <span class="text-[11px] font-label font-bold text-primary uppercase tracking-widest">Kết nối API</span>
       </nav>
       <div class="flex justify-between items-center">
          <h2 class="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Trung tâm kết nối</h2>
          <div class="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
             <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
             <span class="text-[10px] font-bold text-primary uppercase tracking-wider">HỆ THỐNG ĐANG HOẠT ĐỘNG</span>
          </div>
       </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <!-- MAIN LEFT COLUMN (FORMS) -->
        <div class="col-span-12 lg:col-span-7 flex flex-col gap-8">
            <!-- MODULE KẾT NỐI META ADS (CỬA POSTGRES CỦA BẠN) -->
            <section class="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                <!-- Glow Xanh của Architectural AI -->
                <div class="absolute -left-12 -top-12 bg-primary/5 w-64 h-64 blur-3xl rounded-full pointer-events-none"></div>

                <div class="flex items-start justify-between mb-8 relative z-10 border-b border-surface-container-low pb-6">
                <div>
                   <div class="flex items-center gap-3 mb-1">
                      <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600"><span class="material-symbols-outlined fill text-3xl">hub</span></div>
                      <h3 class="text-xl font-headline font-extrabold">Facebook Business Meta</h3>
                   </div>
                   <p class="text-sm font-medium text-on-surface-variant mt-2">Thiết lập kênh dữ liệu cho phân tích chiến dịch & khách hàng.</p>
                </div>
            </div>

            <!-- UI Forms Đồng bộ 2-way với VUE JS Model (Pinia Post qua API FastAPI) -->
            <div class="space-y-5 mb-8 relative z-10">
                <div class="space-y-2">
                   <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Tên gợi nhớ</label>
                   <input v-model="form.accountName" type="text" placeholder="VD: Ads Bất Động Sản..." class="w-full bg-surface p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm font-medium transition-all shadow-sm placeholder:text-on-surface-variant/60 text-on-surface" />
                </div>
                <div class="space-y-2">
                   <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Mã tài khoản quảng cáo</label>
                   <input v-model="form.accountId" type="text" placeholder="act_XXXXXXXXXX" class="w-full bg-surface p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm transition-all shadow-sm placeholder:text-on-surface-variant/60 text-on-surface" />
                </div>
                <div class="space-y-2">
                   <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Access Token</label>
                   <textarea v-model="form.tokenData" rows="3" class="w-full bg-surface p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-primary focus:border-primary font-mono text-xs transition-all shadow-sm text-on-surface placeholder:text-on-surface-variant/60" placeholder="EAAI......."></textarea>
                </div>
            </div>

                <button @click="connectFB" :disabled="appData.isLoading" class="bg-slate-100 border border-slate-300 text-black hover:bg-slate-200 w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] shadow-lg flex items-center justify-center gap-2 hover:shadow-xl active:scale-[0.98] transition-all">
                    <span v-if="appData.isLoading" class="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span class="material-symbols-outlined text-[16px] text-emerald-400" v-else style="font-variation-settings: 'FILL' 1;">security</span>
                    {{ appData.isLoading ? 'Đang kết nối...' : 'Xác thực & Kết nối' }}
                </button>
            </section>

            <!-- MODULE KẾT NỐI GOOGLE SHEETS -->
            <section class="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                <div class="absolute -right-12 -bottom-12 bg-emerald-500/5 w-64 h-64 blur-3xl rounded-full pointer-events-none"></div>

                <div class="flex items-start justify-between mb-8 relative z-10 border-b border-surface-container-low pb-6">
                    <div>
                    <div class="flex items-center gap-3 mb-1">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600"><span class="material-symbols-outlined fill text-3xl">table_chart</span></div>
                        <h3 class="text-xl font-headline font-extrabold">Google Sheets công khai</h3>
                    </div>
                    <p class="text-sm font-medium text-on-surface-variant mt-2">Kết nối nguồn dữ liệu thay thế qua tệp CSV.</p>
                    </div>
                </div>

                <div class="space-y-5 mb-8 relative z-10">
                    <div class="space-y-2">
                    <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Tên bộ dữ liệu</label>
                    <input v-model="formSheet.sheetName" type="text" placeholder="VD: Dữ liệu Q3" class="w-full bg-surface p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition-all shadow-sm placeholder:text-on-surface-variant/60 text-on-surface" />
                    </div>
                    <div class="space-y-2">
                    <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">Tải lên tệp CSV</label>
                    <input type="file" accept=".csv" @change="handleFileUpload" class="w-full bg-surface p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm transition-all shadow-sm placeholder:text-on-surface-variant/60 text-on-surface" />
                    <p class="text-[10px] text-on-surface-variant/70 italic mt-1 ml-1">Chỉ chấp nhận tệp .csv. Dòng đầu phải là tiêu đề cột.</p>
                    </div>
                </div>

                <button @click="connectSheet" :disabled="appData.isLoading" class="bg-emerald-50 border border-emerald-300 text-black hover:bg-emerald-100 w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.1em] shadow-lg flex items-center justify-center gap-2 hover:shadow-xl active:scale-[0.98] transition-all">
                    <span v-if="appData.isLoading" class="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span class="material-symbols-outlined text-[16px]" v-else>upload_file</span>
                    {{ appData.isLoading ? 'Đang tải...' : 'Tải lên dữ liệu' }}
                </button>
            </section>
        </div>

        <!-- KẾT QUẢ DATABASE TRẢ VỀ: ACTIVE INTEGRATIONS CỦA NGƯỜI QUẢN TRỊ NÀY -->
        <section class="col-span-12 lg:col-span-5 bg-surface-container-lowest rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden flex flex-col h-full">
            <div class="p-8 pb-4 border-b border-slate-200">
                <div class="flex items-center gap-3">
                   <div class="w-10 h-10 bg-primary/10 text-primary flex justify-center items-center rounded-lg shadow-sm border border-primary/20"><span class="material-symbols-outlined fill">storage</span></div>
                   <h3 class="text-lg font-headline font-extrabold text-on-surface">Nguồn dữ liệu đã kết nối</h3>
                </div>
            </div>

            <!-- Vùng Danh Sách Tồn Tại trong PostgreSQL của Admin Hiện tại -->
            <div class="flex-1 p-6 space-y-3 overflow-y-auto">
                <div v-if="appData.activeIntegrations.length === 0 && appData.sheetIntegrations.length === 0" class="text-center py-10 flex flex-col items-center">
                    <span class="material-symbols-outlined text-outline text-4xl mb-3 opacity-60">data_alert</span>
                    <p class="text-sm font-extrabold text-on-surface">Chưa có dữ liệu</p>
                    <p class="text-xs mt-2 text-on-surface-variant font-medium w-4/5 text-center leading-relaxed">Sử dụng form bên trái để kết nối nguồn dữ liệu.</p>
                </div>

                <div v-for="integration in appData.activeIntegrations" :key="integration.id" class="p-4 bg-surface hover:bg-surface-container shadow-sm rounded-xl transition-colors border border-slate-200 flex justify-between items-center group">
                    <div class="flex gap-4 items-center">
                        <div class="w-10 h-10 rounded-full border border-primary/30 bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                            <span class="material-symbols-outlined text-[18px] fill">hub</span>
                        </div>
                        <div>
                            <p class="font-extrabold text-sm text-on-surface line-clamp-1">{{ integration.account_name }}</p>
                            <p class="text-xs text-on-surface-variant font-mono mt-0.5">Act ID: {{ integration.ad_account_id }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-lg font-black uppercase text-[10px] text-primary tracking-widest shadow-sm">Đang đồng bộ</span>
                        <button @click="deleteAccount(integration.id)" class="p-1.5 hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Xóa">
                            <span class="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error">delete</span>
                        </button>
                    </div>
                </div>

                <div v-for="sheet in appData.sheetIntegrations" :key="'sheet-'+sheet.id" class="p-4 bg-surface hover:bg-surface-container shadow-sm rounded-xl transition-colors border border-slate-200 flex justify-between items-center group">
                    <div class="flex gap-4 items-center">
                        <div class="w-10 h-10 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <span class="material-symbols-outlined text-[18px] fill">table_chart</span>
                        </div>
                        <div>
                            <p class="font-extrabold text-sm text-on-surface line-clamp-1">{{ sheet.sheet_name }}</p>
                            <p class="text-xs text-on-surface-variant font-mono mt-0.5">ID: {{ sheet.sheet_id.substring(0,10) }}...</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-black uppercase text-[10px] text-emerald-700 tracking-widest shadow-sm">Đang đồng bộ</span>
                        <button @click="deleteSheet(sheet.id)" class="p-1.5 hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Xóa">
                            <span class="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error">delete</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-surface-container p-6 mt-auto border-t border-slate-200 text-center rounded-b-2xl cursor-not-allowed opacity-75">
               <h4 class="font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-2">Kênh Webhook CRM</h4>
               <p class="text-xs text-on-surface-variant font-medium italic">Cấu hình chỉ khả dụng trên môi trường triển khai (HTTPS).</p>
            </div>
        </section>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'
import { useAppDataStore } from '../stores/appData'

const toast = useToast()
const appData = useAppDataStore()

const form = ref({
    accountName: '',
    accountId: '',
    tokenData: ''
})

const formSheet = ref({
    sheetName: '',
    file: null
})

const handleFileUpload = (e) => {
    formSheet.value.file = e.target.files[0]
}

onMounted(() => {
    appData.fetchIntegrations()
    appData.fetchSheetIntegrations()
})

const connectFB = async () => {
    if(!form.value.accountName || !form.value.accountId || !form.value.tokenData) {
        toast.add({severity:'error', summary: 'Lỗi', detail:'Vui lòng điền đầy đủ thông tin trước khi kết nối.', life:3500})
        return;
    }

    const ok = await appData.saveApiConnection(form.value.accountName, form.value.accountId, form.value.tokenData)
    if(ok) {
        form.value.accountName = ''
        form.value.accountId = ''
        form.value.tokenData = ''
    }
}

const connectSheet = async () => {
    if(!formSheet.value.sheetName || !formSheet.value.file) {
        toast.add({severity:'error', summary: 'Lỗi', detail:'Vui lòng nhập tên và chọn tệp CSV.', life:3500})
        return;
    }

    const ok = await appData.saveSheetConnection(formSheet.value.sheetName, formSheet.value.file)
    if(ok) {
        formSheet.value.sheetName = ''
        formSheet.value.file = null
        const fileInput = document.querySelector('input[type="file"]')
        if(fileInput) fileInput.value = ''
    }
}

const deleteAccount = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return
    try {
        await api.delete(`/admin/accounts/${id}`)
        toast.add({ severity: 'success', summary: 'Đã xóa', detail: 'Đã xóa tài khoản thành công.', life: 3000 })
        appData.fetchIntegrations()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể xóa.', life: 4000 })
    }
}

const deleteSheet = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa bộ dữ liệu này?')) return
    try {
        await api.delete(`/admin/sheets/${id}`)
        toast.add({ severity: 'success', summary: 'Đã xóa', detail: 'Đã xóa bộ dữ liệu thành công.', life: 3000 })
        appData.fetchSheetIntegrations()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể xóa.', life: 4000 })
    }
}
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

<template>
  <div class="space-y-8 fade-in-animation">
    <!-- HEADER -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <p class="font-black text-primary text-xs uppercase tracking-[0.3em] mb-1">Quản lý</p>
        <h2 class="text-3xl font-headline font-black text-on-surface tracking-tight">Người dùng & Phân quyền</h2>
      </div>
      <button @click="openAddModal" class="bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
        <span class="material-symbols-outlined text-[16px]">person_add</span> Thêm người dùng
      </button>
    </div>

    <!-- SEARCH BAR -->
    <div class="relative max-w-md">
      <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
      <input v-model="searchQuery" type="text" placeholder="Tìm theo tên hoặc email..." class="w-full bg-surface-container-lowest border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
    </div>

    <!-- USERS TABLE -->
    <div class="bg-surface-container-lowest rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[800px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Người dùng</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Vai trò</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Quyền tài khoản</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Quyền bảng tính</th>
              <th class="px-4 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Trạng thái</th>
              <th class="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-primary/5 transition-colors group">
              <td class="px-6 py-5">
                <div class="flex gap-4 items-center">
                  <div class="w-10 h-10 rounded-full flex justify-center items-center font-bold text-xs shadow-sm"
                       :class="user.role === 'admin' ? 'bg-slate-200 text-black border border-slate-300' : 'bg-primary/10 text-primary border border-primary/20'">
                    {{ getInitials(user.username) }}
                  </div>
                  <div>
                    <p class="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{{ user.username }}</p>
                    <p class="text-[10px] text-on-surface-variant font-medium">ID: {{ user.id }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-5">
                <span class="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider"
                      :class="user.role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container text-on-surface-variant border border-slate-200'">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-4 py-5">
                <span class="text-sm font-bold text-on-surface">{{ user.accounts_count || 0 }}</span>
                <span class="text-xs text-on-surface-variant ml-1">tài khoản</span>
              </td>
              <td class="px-4 py-5">
                <span class="text-sm font-bold text-on-surface">{{ user.sheets_count || 0 }}</span>
                <span class="text-xs text-on-surface-variant ml-1">bảng tính</span>
              </td>
              <td class="px-4 py-5">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-primary"></span>
                  <span class="text-xs font-bold text-on-surface-variant">Hoạt động</span>
                </div>
              </td>
              <td class="px-6 py-5 text-right">
                <div class="flex items-center gap-2 justify-end">
                  <button @click="openPermissionsModal(user)" class="p-2 hover:bg-primary/10 rounded-lg transition-colors" title="Quản lý phân quyền">
                    <span class="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary">shield_person</span>
                  </button>
                  <button @click="openEditModal(user)" class="p-2 hover:bg-primary/10 rounded-lg transition-colors" title="Sửa người dùng">
                    <span class="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary">edit</span>
                  </button>
                  <button @click="confirmDelete(user)" v-if="user.role !== 'admin'" class="p-2 hover:bg-error/10 rounded-lg transition-colors" title="Xóa người dùng">
                    <span class="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error">delete</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="6" class="text-center py-12">
                <span class="material-symbols-outlined text-4xl text-outline-variant/40 mb-2">person_off</span>
                <p class="text-sm font-bold text-on-surface-variant">Không tìm thấy người dùng</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ADD/EDIT USER MODAL -->
    <div v-if="showUserModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="closeUserModal">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200">
        <div class="px-8 py-6 border-b border-slate-200 flex justify-between items-center">
          <h3 class="text-xl font-headline font-bold text-on-surface">{{ editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới' }}</h3>
          <button @click="closeUserModal" class="p-1 hover:bg-surface-container rounded-lg"><span class="material-symbols-outlined text-on-surface-variant">close</span></button>
        </div>
        <div class="p-8 space-y-5">
          <div class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tên đăng nhập</label>
            <input v-model="userForm.username" type="text" placeholder="Nhập tên đăng nhập" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
          </div>
          <div class="space-y-2" v-if="!editingUser">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Mật khẩu</label>
            <input v-model="userForm.password" type="password" placeholder="Nhập mật khẩu" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Vai trò</label>
            <select v-model="userForm.role" class="w-full bg-surface p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all">
              <option value="marketer">Nhân viên marketing</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
        </div>
        <div class="px-8 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button @click="closeUserModal" class="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest">Hủy</button>
          <button @click="saveUser" :disabled="saving" class="bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2">
            <span v-if="saving" class="material-symbols-outlined animate-spin text-[16px]">sync</span>
            {{ saving ? 'Đang lưu...' : (editingUser ? 'Cập nhật' : 'Tạo người dùng') }}
          </button>
        </div>
      </div>
    </div>

    <!-- PERMISSIONS MODAL -->
    <div v-if="showPermModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="closePermModal">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-slate-200">
        <div class="px-8 py-6 border-b border-slate-200">
          <h3 class="text-xl font-headline font-bold text-on-surface">Quản lý phân quyền</h3>
          <p class="text-sm text-on-surface-variant mt-1">Phân quyền cho <span class="font-bold text-primary">{{ permUser?.username }}</span></p>
        </div>
        <div class="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          <!-- Facebook Accounts -->
          <div>
            <h4 class="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px]">hub</span> Tài khoản Facebook Ads
            </h4>
            <div v-if="allAccounts.length === 0" class="text-sm text-on-surface-variant italic py-2">Chưa có tài khoản. Kết nối tài khoản trong Kết nối API trước.</div>
            <div v-else class="space-y-2">
              <label v-for="acc in allAccounts" :key="acc.id" class="flex items-center gap-4 p-3 bg-surface rounded-xl border border-slate-200 hover:border-primary/30 cursor-pointer transition-all">
                <input type="checkbox" :value="acc.id" v-model="selectedAccounts" class="w-4 h-4 accent-primary" />
                <div>
                  <p class="text-sm font-bold text-on-surface">{{ acc.account_name }}</p>
                  <p class="text-[10px] text-on-surface-variant font-mono">{{ acc.ad_account_id }}</p>
                </div>
              </label>
            </div>
          </div>
          <!-- Google Sheets -->
          <div>
            <h4 class="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px]">table_chart</span> Bộ dữ liệu Google Sheets
            </h4>
            <div v-if="allSheets.length === 0" class="text-sm text-on-surface-variant italic py-2">Chưa có bảng tính. Tải CSV trong Kết nối API trước.</div>
            <div v-else class="space-y-2">
              <label v-for="sheet in allSheets" :key="sheet.id" class="flex items-center gap-4 p-3 bg-surface rounded-xl border border-slate-200 hover:border-emerald-500/30 cursor-pointer transition-all">
                <input type="checkbox" :value="sheet.id" v-model="selectedSheets" class="w-4 h-4 accent-emerald-600" />
                <div>
                  <p class="text-sm font-bold text-on-surface">{{ sheet.sheet_name }}</p>
                  <p class="text-[10px] text-on-surface-variant font-mono">ID: {{ sheet.id }}</p>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div class="px-8 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button @click="closePermModal" class="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest">Hủy</button>
          <button @click="savePermissions" :disabled="saving" class="bg-primary/10 border border-primary/30 text-black hover:bg-primary/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2">
            <span v-if="saving" class="material-symbols-outlined animate-spin text-[16px]">sync</span>
            {{ saving ? 'Đang lưu...' : 'Lưu phân quyền' }}
          </button>
        </div>
      </div>
    </div>

    <!-- DELETE CONFIRM MODAL -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showDeleteModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-200">
        <div class="p-8 text-center space-y-4">
          <div class="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-error text-3xl">warning</span>
          </div>
          <h3 class="text-xl font-headline font-bold text-on-surface">Xóa người dùng</h3>
          <p class="text-sm text-on-surface-variant">Bạn có chắc muốn xóa <span class="font-bold text-on-surface">{{ deleteTarget?.username }}</span>? Hành động này không thể hoàn tác.</p>
        </div>
        <div class="px-8 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button @click="showDeleteModal = false" class="px-6 py-3 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors uppercase tracking-widest">Hủy</button>
          <button @click="deleteUser" class="bg-error/10 border border-error/30 text-black hover:bg-error/20 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all">Xóa</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const toast = useToast()

const users = ref([])
const allAccounts = ref([])
const allSheets = ref([])
const searchQuery = ref('')
const saving = ref(false)

// User form
const showUserModal = ref(false)
const editingUser = ref(null)
const userForm = ref({ username: '', password: '', role: 'marketer' })

// Permissions
const showPermModal = ref(false)
const permUser = ref(null)
const selectedAccounts = ref([])
const selectedSheets = ref([])

// Delete
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u => u.username.toLowerCase().includes(q))
})

const getInitials = (name) => {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const loadData = async () => {
  try {
    const [uRes, aRes, sRes] = await Promise.all([
      api.get('/admin/users'),
      api.get('/my-accounts').catch(() => ({ data: { accounts: [] } })),
      api.get('/my-sheets').catch(() => ({ data: { sheets: [] } }))
    ])
    users.value = uRes.data
    allAccounts.value = aRes.data.accounts || []
    allSheets.value = sRes.data.sheets || []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi tải dữ liệu', detail: 'Không thể tải dữ liệu người dùng.', life: 3000 })
  }
}

// ADD/EDIT USER
const openAddModal = () => {
  editingUser.value = null
  userForm.value = { username: '', password: '', role: 'marketer' }
  showUserModal.value = true
}

const openEditModal = (user) => {
  editingUser.value = user
  userForm.value = { username: user.username, password: '', role: user.role }
  showUserModal.value = true
}

const closeUserModal = () => {
  showUserModal.value = false
  editingUser.value = null
}

const saveUser = async () => {
  if (!userForm.value.username) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng nhập tên đăng nhập.', life: 3000 })
    return
  }
  if (!editingUser.value && !userForm.value.password) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Vui lòng nhập mật khẩu cho người dùng mới.', life: 3000 })
    return
  }
  saving.value = true
  try {
    if (editingUser.value) {
      await api.put(`/admin/users/${editingUser.value.id}`, {
        username: userForm.value.username,
        role: userForm.value.role
      })
      toast.add({ severity: 'success', summary: 'Đã cập nhật', detail: `Người dùng ${userForm.value.username} đã cập nhật thành công.`, life: 3000 })
    } else {
      await api.post('/admin/users', {
        username: userForm.value.username,
        password: userForm.value.password,
        role: userForm.value.role
      })
      toast.add({ severity: 'success', summary: 'Đã tạo', detail: `Người dùng ${userForm.value.username} đã tạo thành công.`, life: 3000 })
    }
    closeUserModal()
    await loadData()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể lưu người dùng.', life: 4000 })
  } finally {
    saving.value = false
  }
}

// PERMISSIONS
const openPermissionsModal = async (user) => {
  permUser.value = user
  selectedAccounts.value = user.account_ids || []
  selectedSheets.value = user.sheet_ids || []
  showPermModal.value = true
}

const closePermModal = () => {
  showPermModal.value = false
  permUser.value = null
}

const savePermissions = async () => {
  saving.value = true
  try {
    await api.post('/admin/assign-permissions', {
      user_id: permUser.value.id,
      account_ids: selectedAccounts.value,
      sheet_ids: selectedSheets.value
    })
    toast.add({ severity: 'success', summary: 'Đã cập nhật phân quyền', detail: `Phân quyền cho ${permUser.value.username} đã lưu.`, life: 3000 })
    closePermModal()
    await loadData()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể cập nhật phân quyền.', life: 4000 })
  } finally {
    saving.value = false
  }
}

// DELETE
const confirmDelete = (user) => {
  deleteTarget.value = user
  showDeleteModal.value = true
}

const deleteUser = async () => {
  try {
    await api.delete(`/admin/users/${deleteTarget.value.id}`)
    toast.add({ severity: 'success', summary: 'Đã xóa', detail: `Người dùng ${deleteTarget.value.username} đã xóa.`, life: 3000 })
    showDeleteModal.value = false
    deleteTarget.value = null
    await loadData()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Lỗi', detail: e.response?.data?.detail || 'Không thể xóa người dùng.', life: 4000 })
  }
}

onMounted(loadData)
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

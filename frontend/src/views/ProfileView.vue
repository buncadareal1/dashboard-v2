<template>
  <div class="space-y-8 fade-in-animation max-w-2xl">
    <div>
      <p class="font-black text-primary text-xs uppercase tracking-[0.3em] mb-1">Tài khoản</p>
      <h2 class="text-3xl font-headline font-black text-on-surface tracking-tight">Hồ sơ cá nhân</h2>
    </div>

    <!-- Avatar & Info -->
    <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-6 pb-6 border-b border-slate-200">
        <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 shadow-md">
          <img v-if="authStore.avatar" :src="authStore.avatar" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-black">
            {{ initials }}
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold text-on-surface">{{ authStore.username || 'Chưa đặt tên' }}</h3>
          <p class="text-sm text-on-surface-variant mt-1">{{ authStore.email || 'Chưa liên kết email' }}</p>
          <span class="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                :class="authStore.isAdmin ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-600 border border-slate-200'">
            {{ authStore.isAdmin ? 'Quản trị viên' : 'Nhân viên marketing' }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <div>
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Tên hiển thị</p>
          <p class="text-sm font-bold text-on-surface">{{ authStore.username }}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Email</p>
          <p class="text-sm font-bold text-on-surface">{{ authStore.email || '—' }}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Vai trò</p>
          <p class="text-sm font-bold text-on-surface">{{ authStore.isAdmin ? 'Quản trị viên' : 'Nhân viên marketing' }}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Phương thức đăng nhập</p>
          <p class="text-sm font-bold text-on-surface">{{ authStore.email ? 'Google OAuth' : 'Tài khoản hệ thống' }}</p>
        </div>
      </div>
    </div>

    <!-- Đăng xuất -->
    <div class="bg-surface-container-lowest p-8 rounded-2xl border border-slate-200 shadow-sm">
      <h3 class="text-lg font-headline font-bold text-on-surface mb-4">Phiên đăng nhập</h3>
      <p class="text-sm text-on-surface-variant mb-4">Đăng xuất khỏi tất cả thiết bị và xóa phiên hiện tại.</p>
      <button @click="authStore.logout" class="bg-error/10 border border-error/20 text-error px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-error/20 transition-all">
        Đăng xuất
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const initials = computed(() => {
  const name = authStore.username || ''
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
})
</script>

<style scoped>
.fade-in-animation { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
    <div class="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 text-center">
      <!-- Logo -->
      <div class="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border border-primary/20">
        <span class="material-symbols-outlined text-3xl text-primary" style="font-variation-settings: 'FILL' 1">analytics</span>
      </div>
      <h1 class="text-2xl font-black text-slate-800">SmartLand AI</h1>
      <p class="text-sm text-slate-500 mt-2 mb-8">Đăng nhập bằng tài khoản Google công ty</p>

      <!-- Google Sign-In Button -->
      <div class="space-y-4">
        <button @click="handleGoogleLogin" :disabled="loading"
          class="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50">
          <svg v-if="!loading" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span v-if="loading" class="material-symbols-outlined animate-spin text-[20px]">sync</span>
          {{ loading ? 'Đang xác thực...' : 'Đăng nhập với Google' }}
        </button>

        <!-- Thông báo domain -->
        <p class="text-[11px] text-slate-400">
          Chỉ chấp nhận email <span class="font-bold text-primary">@smartland.vn</span> và <span class="font-bold text-primary">@smartrealtors.vn</span>
        </p>

        <!-- Thông báo lỗi -->
        <div v-if="errorMsg" class="p-3 bg-error/10 border border-error/20 rounded-xl text-sm text-error font-bold">
          {{ errorMsg }}
        </div>
      </div>

      <!-- Đăng nhập bằng tài khoản hệ thống -->
      <div v-if="showDevLogin" class="mt-8 pt-6 border-t border-slate-200">
        <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-4">Hoặc đăng nhập bằng tài khoản</p>
        <form @submit.prevent="submitDev" class="space-y-3 text-left">
          <input v-model="devUser" type="text" placeholder="Tên đăng nhập" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm" />
          <input v-model="devPass" type="password" placeholder="Mật khẩu" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm" />
          <button type="submit" :disabled="loading" class="w-full bg-slate-100 border border-slate-300 text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-all shadow-sm disabled:opacity-50 text-sm">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from 'primevue/usetoast'

const authStore = useAuthStore()
const toast = useToast()
const loading = ref(false)
const errorMsg = ref('')

// Luôn hiện form đăng nhập admin
const showDevLogin = ref(true)
const devUser = ref('')
const devPass = ref('')

onMounted(() => {
  // Nếu chưa cấu hình Google Client ID → hiện form dev
  if (authStore.GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
    showDevLogin.value = true
    return
  }

  // Khởi tạo Google Identity Services
  if (window.google?.accounts) {
    initGoogleLogin()
  } else {
    // Đợi script load xong
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(checkGoogle)
        initGoogleLogin()
      }
    }, 200)
    // Timeout sau 5 giây → hiện dev login
    setTimeout(() => {
      clearInterval(checkGoogle)
      if (!window.google?.accounts) {
        showDevLogin.value = true
      }
    }, 5000)
  }
})

const initGoogleLogin = () => {
  window.google.accounts.id.initialize({
    client_id: authStore.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
  })
}

const handleGoogleLogin = () => {
  errorMsg.value = ''

  if (authStore.GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
    errorMsg.value = 'Chưa cấu hình Google Client ID. Vui lòng liên hệ quản trị viên.'
    return
  }

  if (!window.google?.accounts) {
    errorMsg.value = 'Không thể tải Google Sign-In. Vui lòng thử lại.'
    return
  }

  // Mở popup Google Sign-In
  window.google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Fallback: dùng One Tap hoặc redirect
      window.google.accounts.id.renderButton(
        document.createElement('div'),
        { theme: 'outline', size: 'large' }
      )
      // Thử lại bằng popup
      window.google.accounts.oauth2.initCodeClient({
        client_id: authStore.GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: handleCredentialResponse,
      }).requestCode()
    }
  })
}

const handleCredentialResponse = async (response) => {
  loading.value = true
  errorMsg.value = ''

  try {
    // Decode JWT để kiểm tra domain phía client (backend cũng kiểm tra)
    const payload = JSON.parse(atob(response.credential.split('.')[1]))
    const userEmail = payload.email

    if (!authStore.isAllowedDomain(userEmail)) {
      errorMsg.value = `Email ${userEmail} không thuộc domain được phép. Chỉ chấp nhận @smartland.vn và @smartrealtors.vn`
      loading.value = false
      return
    }

    const result = await authStore.loginWithGoogle(response)
    if (result.success) {
      toast.add({ severity: 'success', summary: 'Chào mừng', detail: 'Đăng nhập thành công!', life: 2000 })
    } else {
      errorMsg.value = result.error
    }
  } catch (e) {
    errorMsg.value = 'Lỗi xác thực Google. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}

// Dev login fallback
const submitDev = async () => {
  loading.value = true
  errorMsg.value = ''
  const success = await authStore.login(devUser.value, devPass.value)
  if (!success) {
    errorMsg.value = 'Sai tên đăng nhập hoặc mật khẩu'
  } else {
    toast.add({ severity: 'success', summary: 'Chào mừng', detail: 'Đăng nhập thành công!', life: 2000 })
  }
  loading.value = false
}
</script>

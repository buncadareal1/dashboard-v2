import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import api from "../lib/axios";

// Domain cho phép đăng nhập
const ALLOWED_DOMAINS = ["smartland.vn", "smartrealtors.vn"];

// Google OAuth Client ID - THAY ĐỔI KHI CÓ
const GOOGLE_CLIENT_ID =
  "678257678050-a0pnf8fcn6a87sggde9e73c7p040ha14.apps.googleusercontent.com";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("token") || null);
  const username = ref(localStorage.getItem("username") || null);
  const email = ref(localStorage.getItem("email") || null);
  const avatar = ref(localStorage.getItem("avatar") || null);
  const role = ref(localStorage.getItem("role") || null);
  const router = useRouter();

  const isAdmin = computed(() => role.value === "admin");
  const isAuthenticated = computed(() => !!token.value);

  // Kiểm tra domain email có hợp lệ không
  const isAllowedDomain = (emailStr) => {
    if (!emailStr) return false;
    const domain = emailStr.split("@")[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  };

  // Đăng nhập bằng Google OAuth
  const loginWithGoogle = async (credentialResponse) => {
    try {
      // Gửi Google ID token về backend để xác thực
      const res = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      token.value = res.data.access_token;
      username.value = res.data.username;
      email.value = res.data.email;
      avatar.value = res.data.avatar || null;
      role.value = res.data.role || "marketer";

      localStorage.setItem("token", token.value);
      localStorage.setItem("username", username.value);
      localStorage.setItem("email", email.value);
      if (avatar.value) localStorage.setItem("avatar", avatar.value);
      localStorage.setItem("role", role.value);

      router.push("/");
      return { success: true };
    } catch (error) {
      const detail = error.response?.data?.detail || "Không thể đăng nhập";
      return { success: false, error: detail };
    }
  };

  // Đăng nhập truyền thống (giữ lại cho dev/fallback)
  const login = async (user, pass) => {
    try {
      const res = await api.post("/login", {
        username: user,
        password: pass,
      });
      token.value = res.data.access_token;
      username.value = res.data.username;
      role.value = res.data.role || "admin";
      localStorage.setItem("token", token.value);
      localStorage.setItem("username", username.value);
      localStorage.setItem("role", role.value);
      router.push("/");
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    token.value = null;
    username.value = null;
    email.value = null;
    avatar.value = null;
    role.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("avatar");
    localStorage.removeItem("role");
    router.push("/login");
  };

  return {
    token,
    username,
    email,
    avatar,
    role,
    isAdmin,
    isAuthenticated,
    GOOGLE_CLIENT_ID,
    ALLOWED_DOMAINS,
    isAllowedDomain,
    loginWithGoogle,
    login,
    logout,
  };
});

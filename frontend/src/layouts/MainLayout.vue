<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <!-- Loading bar -->
        <div v-if="isNavigating" class="fixed top-0 left-0 w-full h-[2px] z-[9999] bg-emerald-100">
            <div class="h-full bg-emerald-500 animate-loading-bar"></div>
        </div>

        <!-- ============ SIDEBAR ============ -->
        <aside
            :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
            class="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-white border-r border-gray-200 transition-transform duration-200"
        >
            <!-- Brand -->
            <div class="flex h-16 items-center gap-2.5 px-5 border-b border-gray-200">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">apartment</span>
                </div>
                <div class="leading-tight">
                    <p class="text-[13px] font-semibold text-gray-900">SmartLand AI</p>
                    <p class="text-[10px] font-medium text-gray-500">Real Estate Tower</p>
                </div>
            </div>

            <!-- Nav -->
            <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <router-link
                    v-for="item in navItems"
                    :key="item.to"
                    :to="item.to"
                    @click="closeMobileSidebar"
                    class="nav-link"
                    active-class="nav-link-active"
                    :exact-active-class="item.exact ? 'nav-link-active' : ''"
                >
                    <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
                    <span>{{ item.label }}</span>
                </router-link>
            </nav>

            <!-- User card (bottom) -->
            <div class="border-t border-gray-200 p-3">
                <div class="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
                    <div class="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-emerald-50">
                        <img v-if="authStore.avatar" :src="authStore.avatar" class="h-full w-full object-cover" :alt="authStore.username || 'avatar'" />
                        <div v-else class="flex h-full w-full items-center justify-center text-xs font-semibold text-emerald-600">
                            {{ userInitial }}
                        </div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-semibold text-gray-900">
                            {{ authStore.username || "Người dùng" }}
                        </p>
                        <p class="truncate text-[10px] text-gray-500">
                            {{ authStore.isAdmin ? "Quản trị viên" : "Nhân viên" }}
                        </p>
                    </div>
                    <button
                        @click="authStore.logout"
                        class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-rose-500 transition-colors"
                        aria-label="Đăng xuất"
                    >
                        <span class="material-symbols-outlined text-[18px]">logout</span>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Mobile overlay -->
        <div v-if="sidebarOpen" @click="sidebarOpen = false" class="fixed inset-0 z-30 bg-black/30 lg:hidden"></div>

        <!-- ============ TOPBAR ============ -->
        <header
            class="fixed top-0 right-0 left-0 lg:left-[220px] z-20 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 lg:px-6"
        >
            <div class="flex flex-1 items-center gap-3">
                <button
                    @click="sidebarOpen = !sidebarOpen"
                    class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
                    aria-label="Mở menu"
                >
                    <span class="material-symbols-outlined">{{ sidebarOpen ? "close" : "menu" }}</span>
                </button>

                <!-- Search -->
                <div class="relative hidden md:block w-full max-w-md">
                    <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tìm kiếm dự án, lead, campaign..."
                        class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                </div>
            </div>

            <div class="flex items-center gap-2">
                <!-- Date range dropdown -->
                <div class="relative hidden sm:block">
                    <button
                        @click="showDateMenu = !showDateMenu"
                        class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <span class="material-symbols-outlined text-[16px] text-gray-500">calendar_today</span>
                        {{ currentDateLabel }}
                        <span class="material-symbols-outlined text-[16px] text-gray-400">expand_more</span>
                    </button>
                    <div
                        v-if="showDateMenu"
                        class="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                    >
                        <button
                            v-for="p in datePresets"
                            :key="p.key"
                            @click="selectDatePreset(p.key)"
                            class="block w-full px-3 py-2 text-left text-xs font-medium hover:bg-emerald-50 hover:text-emerald-600"
                            :class="uiStore.datePreset === p.key ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700'"
                        >
                            {{ p.label }}
                        </button>
                    </div>
                </div>

                <!-- + Tạo mới -->
                <button
                    class="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
                >
                    <span class="material-symbols-outlined text-[16px]">add</span>
                    Tạo mới
                </button>

                <!-- Notification bell -->
                <button
                    @click="showNotif = !showNotif"
                    class="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                    aria-label="Thông báo"
                >
                    <span class="material-symbols-outlined text-[20px]">notifications</span>
                    <span
                        v-if="uiStore.unreadCount > 0"
                        class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white"
                    >
                        {{ uiStore.unreadCount > 9 ? "9+" : uiStore.unreadCount }}
                    </span>
                </button>

                <!-- Avatar -->
                <div class="h-9 w-9 overflow-hidden rounded-full border border-gray-200 bg-emerald-50">
                    <img v-if="authStore.avatar" :src="authStore.avatar" class="h-full w-full object-cover" :alt="authStore.username || 'avatar'" />
                    <div v-else class="flex h-full w-full items-center justify-center text-xs font-semibold text-emerald-600">
                        {{ userInitial }}
                    </div>
                </div>
            </div>
        </header>

        <!-- Click-out for date menu -->
        <div v-if="showDateMenu" @click="showDateMenu = false" class="fixed inset-0 z-40"></div>

        <!-- ============ MAIN ============ -->
        <main class="lg:ml-[220px] pt-16 min-h-screen">
            <Toast position="bottom-right" />
            <div class="fade-in">
                <router-view />
            </div>
        </main>
    </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";
import Toast from "primevue/toast";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();

const sidebarOpen = ref(false);
const showNotif = ref(false);
const showDateMenu = ref(false);
const searchQuery = ref("");

const navItems = [
    { to: "/", label: "Bảng điều khiển", icon: "dashboard", exact: true },
    { to: "/projects", label: "Quản lý dự án", icon: "apartment" },
    { to: "/report-data", label: "Report Data", icon: "table_chart" },
    { to: "/analytics", label: "Analytics", icon: "monitoring" },
    { to: "/settings", label: "Cài đặt", icon: "settings" },
];

const datePresets = [
    { key: "7d", label: "7 ngày qua" },
    { key: "14d", label: "14 ngày qua" },
    { key: "30d", label: "30 ngày qua" },
    { key: "90d", label: "90 ngày qua" },
];

const currentDateLabel = computed(() => {
    const found = datePresets.find((p) => p.key === uiStore.datePreset);
    return found ? found.label : "30 ngày qua";
});

const userInitial = computed(() => {
    const name = authStore.username || "?";
    return name.charAt(0).toUpperCase();
});

const selectDatePreset = (key) => {
    if (typeof uiStore.setDatePreset === "function") {
        uiStore.setDatePreset(key);
    }
    showDateMenu.value = false;
};

const closeMobileSidebar = () => {
    sidebarOpen.value = false;
};

// Loading bar
const isNavigating = ref(false);
router.beforeEach(() => {
    isNavigating.value = true;
});
router.afterEach(() => {
    setTimeout(() => {
        isNavigating.value = false;
    }, 250);
});
</script>

<style scoped>
.nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: 0.625rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #475569;
    transition: all 0.15s ease;
}
.nav-link:hover {
    background: #f1f5f9;
    color: #0f172a;
}
.nav-link-active {
    background: #ecfdf5;
    color: #047857;
    font-weight: 600;
}
.nav-link-active .material-symbols-outlined {
    font-variation-settings: "FILL" 1;
}

.fade-in {
    animation: fadeIn 0.25s ease-out;
}
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
@keyframes loadingBar {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 100%; }
}
.animate-loading-bar {
    animation: loadingBar 0.6s ease-in-out;
}
</style>

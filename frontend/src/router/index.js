import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import MainLayout from '../layouts/MainLayout.vue'

const routes = [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
        path: '/',
        component: MainLayout,
        meta: { requiresAuth: true },
        children: [
            { path: '', name: 'Dashboard', component: () => import('../views/DashboardView.vue') },
            { path: 'users', name: 'Users', component: () => import('../views/UserManagementView.vue'), meta: { adminOnly: true } },
            { path: 'api-hub', name: 'ApiHub', component: () => import('../views/ApiHubView.vue'), meta: { adminOnly: true } },
            { path: 'campaigns', name: 'Campaigns', component: () => import('../views/CampaignsView.vue') },
            { path: 'campaigns/:id', name: 'CampaignDetail', component: () => import('../views/CampaignDetailView.vue') },
            { path: 'ai-analytics', name: 'AiAnalytics', component: () => import('../views/AiAnalyticsView.vue'), meta: { adminOnly: true } },
            { path: 'activity-log', name: 'ActivityLog', component: () => import('../views/ActivityLogView.vue'), meta: { adminOnly: true } },
            { path: 'reports', name: 'Reports', component: () => import('../views/ReportsView.vue') },
            { path: 'leads', name: 'Leads', component: () => import('../views/LeadsView.vue') },
            { path: 'settings', name: 'Settings', component: () => import('../views/SettingsView.vue') },
            { path: 'profile', name: 'Profile', component: () => import('../views/ProfileView.vue') },
        ]
    },
    // 404 catch-all
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFoundView.vue') }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    // Chưa đăng nhập → về login
    if (to.meta.requiresAuth && !authStore.token) {
        next('/login')
    }
    // Đã đăng nhập → không cho vào login
    else if (to.path === '/login' && authStore.token) {
        next('/')
    }
    // Trang chỉ dành cho admin
    else if (to.meta.adminOnly && !authStore.isAdmin) {
        next('/')
    }
    else {
        next()
    }
})

export default router

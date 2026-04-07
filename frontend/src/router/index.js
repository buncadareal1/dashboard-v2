import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import MainLayout from '../layouts/MainLayout.vue'

/**
 * Routes — Readdy.ai redesign (Phase 1)
 * 6 trang chính: Dashboard / Projects / ProjectDetail / ReportData / Analytics / Settings
 * Old views (Campaigns, Reports, Leads, ApiHub, ...) sẽ được xoá ở Phase 6.
 */
const routes = [
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
    },
    {
        path: '/',
        component: MainLayout,
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                name: 'Dashboard',
                component: () => import('../views/DashboardView.vue'),
            },
            {
                path: 'projects',
                name: 'Projects',
                component: () => import('../views/ProjectsView.vue'),
            },
            {
                path: 'projects/:id',
                name: 'ProjectDetail',
                component: () => import('../views/ProjectDetailView.vue'),
            },
            {
                path: 'report-data',
                name: 'ReportData',
                component: () => import('../views/ReportDataView.vue'),
            },
            {
                path: 'analytics',
                name: 'Analytics',
                component: () => import('../views/AnalyticsView.vue'),
            },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('../views/SettingsView.vue'),
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../views/NotFoundView.vue'),
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth && !authStore.token) {
        next('/login')
    } else if (to.path === '/login' && authStore.token) {
        next('/')
    } else if (to.meta.adminOnly && !authStore.isAdmin) {
        next('/')
    } else {
        next()
    }
})

export default router

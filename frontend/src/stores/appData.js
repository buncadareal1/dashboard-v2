import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../lib/axios'
import { useToast } from "primevue/usetoast"
import { useUiStore } from './ui'
import { dashboardWS } from '../lib/websocket'
import { MOCK_PROJECTS } from '../lib/mockProjects'
import { MOCK_LEADS } from '../lib/mockLeads'

export const useAppDataStore = defineStore('appData', () => {
    const toast = useToast()
    const uiStore = useUiStore()

    // 1. STATE (Bộ chứa dữ liệu)
    const dashboardKpis = ref([])
    const topCampaigns = ref([])
    const activeIntegrations = ref([])
    const sheetIntegrations = ref([])

    // ===== Real Estate domain (Phase A: mock, Phase B: load từ /api) =====
    const projects = ref([])
    const leads = ref([])

    /**
     * Tìm project theo id từ store. Computed factory.
     * @param {string} id
     */
    const getProjectById = (id) => computed(() => projects.value.find((p) => p.id === id))

    /**
     * Phase A: trả về mock data ngay lập tức.
     * Phase B: thay bằng `const res = await api.get('/projects'); projects.value = res.data`
     */
    const fetchProjects = async () => {
        projects.value = [...MOCK_PROJECTS]
        return projects.value
    }

    /**
     * Phase A: derive 1 project từ mock theo id.
     * Phase B: `await api.get(`/projects/${id}`)` để lấy dữ liệu chi tiết (units, creatives, ...).
     */
    const fetchProjectById = async (id) => {
        if (projects.value.length === 0) await fetchProjects()
        return projects.value.find((p) => p.id === id) || null
    }

    /**
     * Phase A: trả về mock leads.
     * Phase B: `await api.get('/leads', { params: filters })`
     */
    const fetchLeads = async () => {
        leads.value = [...MOCK_LEADS]
        return leads.value
    }

    // Trạng thái hệ thống
    const isLoading = ref(false)
    const wsConnected = ref(false)

    // Auto-refresh (fallback khi WebSocket không khả dụng)
    const autoRefreshIntervalId = ref(null)

    const startAutoRefresh = (intervalMs = 300000) => {
        stopAutoRefresh()
        autoRefreshIntervalId.value = setInterval(() => {
            fetchCampaigns()
        }, intervalMs)
    }

    const stopAutoRefresh = () => {
        if (autoRefreshIntervalId.value) {
            clearInterval(autoRefreshIntervalId.value)
            autoRefreshIntervalId.value = null
        }
    }

    // WebSocket real-time connection
    const initRealtime = (token) => {
        dashboardWS.connect(token)

        dashboardWS
            .on('new_lead', (payload) => {
                // Phase A: refetch + push payload nếu có
                fetchDashboardStats()
                if (payload && payload.id) {
                    leads.value = [payload, ...leads.value]
                }
                toast.add({ severity: 'info', summary: 'Lead mới', detail: 'Có lead mới từ Bitrix24', life: 3000 })
                uiStore.addNotification({ title: 'Lead mới', desc: 'Có lead mới từ Bitrix24 CRM', type: 'info', category: 'lead' })
            })
            .on('lead_updated', () => {
                fetchDashboardStats()
            })
            .on('campaign_synced', () => {
                fetchCampaigns()
            })
            .on('kpi_updated', (data) => {
                if (data) {
                    // Direct KPI update without API call
                    dashboardKpis.value = [
                        { name: "Total Ad Spend", value: data.total_spend, sub: "Past 30 days overall", trend: "+4.2%", icon: "payments", bgIcon: "bg-primary-fixed", txtIcon: "text-on-primary-fixed-variant" },
                        { name: "Verified Leads", value: data.verified_leads, sub: "CRM Sync", trend: "+18%", icon: "hub", bgIcon: "bg-primary-fixed/40", txtIcon: "text-primary" },
                        { name: "Avg CPC Value", value: data.avg_cpc, sub: "Lowest rate", trend: "-2.4%", icon: "ads_click", bgIcon: "bg-secondary-fixed", txtIcon: "text-secondary" },
                        { name: "Global RoAS", value: data.roas, sub: "Return on Ad spend", trend: "TOP", icon: "trending_up", bgIcon: "bg-primary-container", txtIcon: "text-white" },
                    ]
                }
            })
            .on('ai_complete', (data) => {
                toast.add({ severity: 'success', summary: 'AI Analysis', detail: 'Phân tích AI hoàn tất', life: 3000 })
                uiStore.addNotification({ title: 'Phân tích AI hoàn tất', desc: 'AI đã phân tích xong chiến dịch. Xem kết quả ngay.', type: 'success', category: 'ai' })
            })

        wsConnected.value = true

        // Use longer polling interval as backup when WS is active
        startAutoRefresh(600000) // 10 min backup instead of 5 min
    }

    const stopRealtime = () => {
        dashboardWS.disconnect()
        wsConnected.value = false
        stopAutoRefresh()
    }

    // 2. ACTIONS (Hàm tương tác với Backend)

    // Kéo dữ liệu thống kê tổng cho Dashboard (từ Facebook Ads API thật)
    const fetchDashboardStats = async () => {
        isLoading.value = true
        try {
            const response = await api.get('/dashboard-stats')
            const data = response.data.data
            dashboardKpis.value = [
                { name: "Total Ad Spend", value: data.total_spend, sub: "Facebook Ads", trend: (data.total_campaigns || 0) + " campaigns", icon: "payments", bgIcon: "bg-primary-fixed", txtIcon: "text-on-primary-fixed-variant" },
                { name: "Verified Leads", value: data.verified_leads, sub: "CRM Sync", trend: data.ctr || "", icon: "hub", bgIcon: "bg-primary-fixed/40", txtIcon: "text-primary" },
                { name: "Avg CPC Value", value: data.avg_cpc, sub: "Chi phí mỗi click", trend: data.total_clicks ? data.total_clicks.toLocaleString() + " clicks" : "", icon: "ads_click", bgIcon: "bg-secondary-fixed", txtIcon: "text-secondary" },
                { name: "Global RoAS", value: data.roas, sub: "Return on Ad spend", trend: data.total_revenue || "", icon: "trending_up", bgIcon: "bg-primary-container", txtIcon: "text-white" },
            ]
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Sync Error', detail: 'Không thể lấy KPI từ CSDL', life: 3000 })
        } finally {
            isLoading.value = false
        }
    }

    // Kéo dữ liệu các chiến dịch (Facebook Ads API thật + Google Sheets)
    const fetchCampaigns = async () => {
        isLoading.value = true
        try {
            const [fbRes, sheetRes] = await Promise.all([
                api.get('/facebook-data').catch(() => ({ data: { data: [] } })),
                api.get('/sheet-data').catch(() => ({ data: { data: [] } }))
            ])

            const fbData = fbRes.data?.data || []
            const sheetData = sheetRes.data?.data || []

            topCampaigns.value = [...fbData, ...sheetData]
        } catch (error) {
            console.error("Lỗi kéo dữ liệu: ", error)
        } finally {
            isLoading.value = false
        }
    }

    // Kết nối và lưu API Key mới
    const saveApiConnection = async (accountName, adAccountId, token) => {
        try {
            await api.post('/admin/connect-facebook', {
                account_name: accountName,
                ad_account_id: adAccountId,
                access_token: token
            })
            toast.add({ severity: 'success', summary: 'Verified', detail: 'Đã thiết lập ống truyền tải với Meta Graph API.', life: 3000 })
            await fetchIntegrations() // Reload danh sách ngay lập tức
            return true
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Invalid Auth', detail: error.response?.data?.detail || 'Lỗi kết nối', life: 4000 })
            return false
        }
    }

    // Kéo danh sách API Key đã lưu trong PostgreSQL
    const fetchIntegrations = async () => {
        try {
            const response = await api.get('/my-accounts')
            activeIntegrations.value = response.data.accounts
        } catch (e) { }
    }

    // Tải lên Google Sheet (CSV File) Mới
    const saveSheetConnection = async (sheetName, file) => {
        try {
            const formData = new FormData()
            formData.append('sheet_name', sheetName)
            formData.append('file', file)

            await api.post('/admin/connect-sheet', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.add({ severity: 'success', summary: 'Dataset Uploaded', detail: 'Đã lưu trữ bộ dữ liệu CSV thành công.', life: 3000 })
            await fetchSheetIntegrations()
            return true
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Upload Failed', detail: error.response?.data?.detail || error.response?.data?.message || 'Lỗi tải file', life: 4000 })
            return false
        }
    }

    // Kéo danh sách Sheets đã kết nối
    const fetchSheetIntegrations = async () => {
        try {
            const response = await api.get('/my-sheets')
            sheetIntegrations.value = response.data.sheets
        } catch (e) { }
    }

    return {
        dashboardKpis, topCampaigns, activeIntegrations, sheetIntegrations,
        isLoading, wsConnected,
        // Real estate domain
        projects, leads,
        fetchProjects, fetchProjectById, fetchLeads, getProjectById,
        // Legacy
        fetchDashboardStats, fetchCampaigns, saveApiConnection, fetchIntegrations,
        saveSheetConnection, fetchSheetIntegrations,
        startAutoRefresh, stopAutoRefresh,
        initRealtime, stopRealtime
    }
})
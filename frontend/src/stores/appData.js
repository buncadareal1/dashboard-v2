import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/axios'
import { useToast } from "primevue/usetoast"

export const useAppDataStore = defineStore('appData', () => {
    const toast = useToast()

    // 1. STATE (Bộ chứa dữ liệu)
    const dashboardKpis = ref([])
    const topCampaigns = ref([])
    const activeIntegrations = ref([])
    const sheetIntegrations = ref([])

    // Trạng thái hệ thống
    const isLoading = ref(false)

    // Auto-refresh
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

    // 2. ACTIONS (Hàm tương tác với Backend)

    // Kéo dữ liệu thống kê tổng cho Dashboard
    const fetchDashboardStats = async () => {
        isLoading.value = true
        try {
            const response = await api.get('/dashboard-stats')

            // Xử lý dữ liệu thô từ Backend sang chuẩn hiển thị của UX
            const data = response.data.data
            dashboardKpis.value = [
                { name: "Total Ad Spend", value: data.total_spend, sub: "Past 30 days overall", trend: "+4.2%", icon: "payments", bgIcon: "bg-primary-fixed", txtIcon: "text-on-primary-fixed-variant" },
                { name: "Verified Leads", value: "1,284", sub: "CRM Sync", trend: "+18%", icon: "hub", bgIcon: "bg-primary-fixed/40", txtIcon: "text-primary" },
                { name: "Avg CPC Value", value: "$1.42", sub: "Lowest rate", trend: "-2.4%", icon: "ads_click", bgIcon: "bg-secondary-fixed", txtIcon: "text-secondary" },
                { name: "Global RoAS", value: data.roas, sub: "Return on Ad spend", trend: "TOP", icon: "trending_up", bgIcon: "bg-primary-container", txtIcon: "text-white" },
            ]
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Sync Error', detail: 'Không thể lấy KPI từ CSDL', life: 3000 })
        } finally {
            isLoading.value = false
        }
    }

    // Kéo dữ liệu các chiến dịch (Facebook & Google Sheets)
    const fetchCampaigns = async () => {
        isLoading.value = true
        try {
            // Tải dữ liệu song song 2 luồng
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
        dashboardKpis, topCampaigns, activeIntegrations, sheetIntegrations, isLoading,
        fetchDashboardStats, fetchCampaigns, saveApiConnection, fetchIntegrations,
        saveSheetConnection, fetchSheetIntegrations,
        startAutoRefresh, stopAutoRefresh
    }
})
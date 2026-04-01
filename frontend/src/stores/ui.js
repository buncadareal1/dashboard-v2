import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUiStore = defineStore('ui', () => {
    // Date Range Picker global
    const dateFrom = ref(formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
    const dateTo = ref(formatDate(new Date()))
    const datePreset = ref('7d')

    function formatDate(d) {
        return d.toISOString().split('T')[0]
    }

    const setDatePreset = (preset) => {
        datePreset.value = preset
        const now = new Date()
        dateTo.value = formatDate(now)
        if (preset === '7d') dateFrom.value = formatDate(new Date(now - 7 * 86400000))
        else if (preset === '14d') dateFrom.value = formatDate(new Date(now - 14 * 86400000))
        else if (preset === '30d') dateFrom.value = formatDate(new Date(now - 30 * 86400000))
        else if (preset === '90d') dateFrom.value = formatDate(new Date(now - 90 * 86400000))
        else { dateFrom.value = '2024-01-01'; datePreset.value = 'all' }
    }

    const setCustomRange = (from, to) => {
        dateFrom.value = from
        dateTo.value = to
        datePreset.value = 'custom'
    }

    const dateRangeLabel = computed(() => {
        if (datePreset.value === '7d') return '7 ngày qua'
        if (datePreset.value === '14d') return '14 ngày qua'
        if (datePreset.value === '30d') return '30 ngày qua'
        if (datePreset.value === '90d') return '90 ngày qua'
        if (datePreset.value === 'all') return 'Tất cả'
        return `${dateFrom.value} → ${dateTo.value}`
    })

    // Thông báo
    const notifications = ref([
        { id: 1, title: 'Cảnh báo CPL', desc: 'Chiến dịch Bất Động Sản vượt trần 150k', type: 'error' },
        { id: 2, title: 'Đề xuất AI', desc: 'AI đề xuất tắt chiến dịch "Video Demo"', type: 'info' }
    ])

    // Dark mode
    const isDarkMode = ref(localStorage.getItem('theme') === 'dark')
    const toggleDark = () => {
        isDarkMode.value = !isDarkMode.value
        localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', isDarkMode.value)
    }
    if (isDarkMode.value) document.documentElement.classList.add('dark')

    // Ngưỡng ngân sách
    const budgetLimit = ref(5000)
    const checkBudgetAlert = (currentSpend) => currentSpend > budgetLimit.value

    return {
        dateFrom, dateTo, datePreset, dateRangeLabel,
        setDatePreset, setCustomRange, formatDate,
        notifications, isDarkMode, toggleDark,
        budgetLimit, checkBudgetAlert
    }
})

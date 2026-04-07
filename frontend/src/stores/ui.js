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

    // Thông báo nâng cao
    const notifications = ref(JSON.parse(localStorage.getItem('notifications') || '[]').length > 0
        ? JSON.parse(localStorage.getItem('notifications'))
        : [
            { id: 1, title: 'Cảnh báo CPL', desc: 'Chiến dịch Bất Động Sản vượt trần 150k', type: 'error', read: false, time: new Date().toISOString(), category: 'budget' },
            { id: 2, title: 'Đề xuất AI', desc: 'AI đề xuất tắt chiến dịch "Video Demo"', type: 'info', read: false, time: new Date().toISOString(), category: 'ai' }
        ]
    )

    const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

    const addNotification = (notification) => {
        const newNotif = {
            id: Date.now(),
            time: new Date().toISOString(),
            read: false,
            ...notification
        }
        notifications.value = [newNotif, ...notifications.value].slice(0, 50)
        _persistNotifications()
    }

    const markAsRead = (id) => {
        notifications.value = notifications.value.map(n =>
            n.id === id ? { ...n, read: true } : n
        )
        _persistNotifications()
    }

    const markAllAsRead = () => {
        notifications.value = notifications.value.map(n => ({ ...n, read: true }))
        _persistNotifications()
    }

    const removeNotification = (id) => {
        notifications.value = notifications.value.filter(n => n.id !== id)
        _persistNotifications()
    }

    const clearAllNotifications = () => {
        notifications.value = []
        _persistNotifications()
    }

    const _persistNotifications = () => {
        localStorage.setItem('notifications', JSON.stringify(notifications.value))
    }

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
        notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, clearAllNotifications,
        isDarkMode, toggleDark,
        budgetLimit, checkBudgetAlert
    }
})

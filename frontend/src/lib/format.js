/**
 * Formatters cho UI Real Estate dashboard.
 */

/**
 * Format số tiền VND theo style Readdy:
 *   >= 1 tỷ → "12.45 tỷ"
 *   >= 1 triệu → "850M" hoặc "9.77M"
 *   >= 1000 → "682K"
 *   ngược lại → "523"
 *
 * @param {number} value
 * @param {{ maxFraction?: number }} [opts]
 * @returns {string}
 */
export function formatVndShort(value, opts = {}) {
    const { maxFraction = 2 } = opts
    if (value == null || isNaN(value)) return '—'
    const abs = Math.abs(value)

    if (abs >= 1e9) return `${(value / 1e9).toFixed(maxFraction).replace(/\.?0+$/, '')} tỷ`
    if (abs >= 1e6) return `${(value / 1e6).toFixed(maxFraction).replace(/\.?0+$/, '')}M`
    if (abs >= 1e3) return `${Math.round(value / 1e3)}K`
    return String(Math.round(value))
}

/**
 * Format số tiền theo đơn vị triệu (M) cho cột bảng.
 * @param {number} value
 * @returns {string}
 */
export function formatMillions(value) {
    if (value == null || isNaN(value)) return '—'
    return new Intl.NumberFormat('vi-VN').format(Math.round(value / 1e6))
}

/**
 * Format số nguyên có dấu phân cách hàng nghìn.
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
    if (value == null || isNaN(value)) return '—'
    return new Intl.NumberFormat('vi-VN').format(value)
}

/**
 * Format phần trăm: 6.2 → "6.2%"
 * @param {number} value
 * @param {number} [fraction=1]
 * @returns {string}
 */
export function formatPercent(value, fraction = 1) {
    if (value == null || isNaN(value)) return '—'
    return `${value.toFixed(fraction)}%`
}

/**
 * Mapping kênh quảng cáo → label + màu badge.
 * @param {'facebook'|'google'|'tiktok'|'youtube'|'zalo'} ch
 */
export function getChannelBadge(ch) {
    const map = {
        facebook: { label: 'Facebook', class: 'bg-blue-50 text-blue-700 border-blue-100' },
        google: { label: 'Google', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
        tiktok: { label: 'TikTok', class: 'bg-slate-900 text-white border-slate-900' },
        youtube: { label: 'YouTube', class: 'bg-rose-50 text-rose-700 border-rose-100' },
        zalo: { label: 'Zalo', class: 'bg-sky-50 text-sky-700 border-sky-100' },
    }
    return map[ch] || { label: ch, class: 'bg-slate-100 text-slate-600 border-slate-200' }
}

/**
 * Mapping trạng thái dự án → label + class màu.
 * @param {'running'|'warning'|'paused'} status
 */
export function getProjectStatusBadge(status) {
    switch (status) {
        case 'running':
            return { label: 'Đang chạy', class: 'bg-emerald-50 text-emerald-600' }
        case 'warning':
            return { label: 'Cảnh báo', class: 'bg-amber-50 text-amber-600' }
        case 'paused':
            return { label: 'Tạm dừng', class: 'bg-gray-100 text-gray-600' }
        default:
            return { label: status, class: 'bg-gray-100 text-gray-600' }
    }
}

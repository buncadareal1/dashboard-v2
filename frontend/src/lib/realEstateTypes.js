/**
 * @file Type definitions (JSDoc) cho domain Real Estate Marketing.
 * Dùng chung giữa mock data Phase A và API thật ở Phase B.
 *
 * @typedef {'running' | 'warning' | 'paused'} ProjectStatus
 *
 * @typedef {'facebook' | 'google' | 'tiktok' | 'youtube' | 'zalo'} Channel
 *
 * @typedef {'F1' | 'Đang chăm' | 'Booking' | 'Deal'} LeadFunnelLabel
 *
 * @typedef {Object} Employee
 * @property {string} id
 * @property {string} name
 * @property {string} initial   - Chữ cái đầu cho avatar fallback
 * @property {string} [color]   - tailwind color token
 *
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} location              - "Quận 9, TP.HCM"
 * @property {ProjectStatus} status
 * @property {Employee} owner               - Nhân viên Marketing phụ trách
 * @property {number} totalUnits            - Tổng số căn
 * @property {number} soldUnits             - Số căn đã chốt
 * @property {number} totalBudget           - Chi phí Marketing (VND)
 * @property {number} totalRevenue          - Doanh số (VND)
 * @property {number} dealCount
 * @property {number} bookingCount
 * @property {number} f1Count
 * @property {number} leadCount
 * @property {Channel[]} channels
 *
 * @typedef {Object} DashboardKpi
 * @property {string} key
 * @property {string} label
 * @property {string} value          - Pre-formatted (e.g. "46.58 tỷ")
 * @property {number} change         - Phần trăm so kỳ trước (+18.2 = +18.2%)
 * @property {string} icon           - Material symbol name
 * @property {string} color          - tailwind color class prefix
 */

export {}

import { describe, it, expect } from 'vitest'
import {
    formatVndShort,
    formatMillions,
    formatNumber,
    formatPercent,
    getProjectStatusBadge,
    getChannelBadge,
} from './format'

describe('formatVndShort', () => {
    it('formats >= 1 tỷ as "X.YZ tỷ"', () => {
        expect(formatVndShort(12_450_000_000)).toBe('12.45 tỷ')
        expect(formatVndShort(1_000_000_000)).toBe('1 tỷ')
    })
    it('formats >= 1M as "XM"', () => {
        expect(formatVndShort(850_000_000)).toBe('850M')
        expect(formatVndShort(9_770_000)).toBe('9.77M')
    })
    it('formats >= 1K as "XK"', () => {
        expect(formatVndShort(682_000)).toBe('682K')
    })
    it('handles null/NaN', () => {
        expect(formatVndShort(null)).toBe('—')
        expect(formatVndShort(NaN)).toBe('—')
    })
})

describe('formatMillions', () => {
    it('divides by 1e6 and formats vi-VN', () => {
        expect(formatMillions(850_000_000)).toBe('850')
        expect(formatMillions(12_450_000_000)).toBe('12.450')
    })
})

describe('formatPercent', () => {
    it('appends % with 1 decimal by default', () => {
        expect(formatPercent(6.83)).toBe('6.8%')
        expect(formatPercent(33.97, 0)).toBe('34%')
    })
})

describe('formatNumber', () => {
    it('formats vi-VN locale', () => {
        expect(formatNumber(1247)).toBe('1.247')
    })
})

describe('getProjectStatusBadge', () => {
    it('returns label + class for known statuses', () => {
        expect(getProjectStatusBadge('running').label).toBe('Đang chạy')
        expect(getProjectStatusBadge('warning').label).toBe('Cảnh báo')
        expect(getProjectStatusBadge('paused').label).toBe('Tạm dừng')
    })
    it('emerald class for running, amber for warning', () => {
        expect(getProjectStatusBadge('running').class).toContain('emerald')
        expect(getProjectStatusBadge('warning').class).toContain('amber')
    })
})

describe('getChannelBadge', () => {
    it('maps channel id to label', () => {
        expect(getChannelBadge('facebook').label).toBe('Facebook')
        expect(getChannelBadge('zalo').label).toBe('Zalo')
    })
})

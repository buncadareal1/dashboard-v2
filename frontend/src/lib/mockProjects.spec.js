import { describe, it, expect } from 'vitest'
import { MOCK_PROJECTS } from './mockProjects'

describe('MOCK_PROJECTS data integrity', () => {
    it('has exactly 6 projects matching Readdy preview', () => {
        expect(MOCK_PROJECTS).toHaveLength(6)
    })

    it('every project has required fields', () => {
        for (const p of MOCK_PROJECTS) {
            expect(p.id).toBeTypeOf('string')
            expect(p.name).toBeTypeOf('string')
            expect(p.location).toBeTypeOf('string')
            expect(['running', 'warning', 'paused']).toContain(p.status)
            expect(p.owner).toBeDefined()
            expect(p.owner.initial).toMatch(/^[A-Z]$/)
            expect(p.totalUnits).toBeGreaterThan(0)
            expect(p.soldUnits).toBeLessThanOrEqual(p.totalUnits)
            expect(p.totalBudget).toBeGreaterThan(0)
            expect(p.totalRevenue).toBeGreaterThan(p.totalBudget)
            expect(p.leadCount).toBeGreaterThan(p.f1Count)
            expect(p.f1Count).toBeGreaterThan(p.bookingCount)
            expect(Array.isArray(p.channels)).toBe(true)
        }
    })

    it('totals match Readdy preview (351 deals, ~46.58 tỷ revenue)', () => {
        const totals = MOCK_PROJECTS.reduce(
            (acc, p) => {
                acc.deal += p.dealCount
                acc.revenue += p.totalRevenue
                return acc
            },
            { deal: 0, revenue: 0 }
        )
        expect(totals.deal).toBe(351)
        // 12.45 + 8.92 + 7.56 + 5.68 + 4.85 + 7.12 = 46.58 tỷ
        expect(totals.revenue).toBe(46_580_000_000)
    })

    it('Vinhomes Grand Park matches Readdy values exactly', () => {
        const vgp = MOCK_PROJECTS.find((p) => p.id === 'vinhomes-grand-park')
        expect(vgp).toBeDefined()
        expect(vgp.leadCount).toBe(1247)
        expect(vgp.f1Count).toBe(418)
        expect(vgp.bookingCount).toBe(142)
        expect(vgp.dealCount).toBe(87)
        expect(vgp.totalBudget).toBe(850_000_000)
    })
})

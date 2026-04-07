import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KpiCard from './KpiCard.vue'

describe('KpiCard', () => {
    it('renders label, value, and icon', () => {
        const wrapper = mount(KpiCard, {
            props: {
                label: 'Tổng doanh số',
                value: '46.58 tỷ',
                icon: 'payments',
                change: 18.2,
            },
        })
        expect(wrapper.text()).toContain('Tổng doanh số')
        expect(wrapper.text()).toContain('46.58 tỷ')
        expect(wrapper.text()).toContain('payments')
    })

    it('shows + sign and emerald color for positive change', () => {
        const wrapper = mount(KpiCard, {
            props: { label: 'X', value: '1', change: 12 },
        })
        expect(wrapper.text()).toContain('+12%')
        expect(wrapper.html()).toContain('emerald')
    })

    it('shows - sign and red color for negative change', () => {
        const wrapper = mount(KpiCard, {
            props: { label: 'X', value: '1', change: -5 },
        })
        expect(wrapper.text()).toContain('-5%')
        expect(wrapper.html()).toContain('red')
    })

    it('accepts string change for non-percent units', () => {
        const wrapper = mount(KpiCard, {
            props: { label: 'X', value: '1', change: '+2.1 ngày' },
        })
        expect(wrapper.text()).toContain('+2.1 ngày')
    })

    it('hides change badge when change is null', () => {
        const wrapper = mount(KpiCard, {
            props: { label: 'X', value: '1', change: null },
        })
        expect(wrapper.text()).not.toMatch(/[+-]\d/)
    })
})

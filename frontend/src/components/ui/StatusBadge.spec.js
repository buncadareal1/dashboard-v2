import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from './StatusBadge.vue'

describe('StatusBadge', () => {
    it('renders Đang chạy for running status', () => {
        const w = mount(StatusBadge, { props: { status: 'running' } })
        expect(w.text()).toBe('Đang chạy')
        expect(w.html()).toContain('emerald')
    })
    it('renders Cảnh báo for warning status', () => {
        const w = mount(StatusBadge, { props: { status: 'warning' } })
        expect(w.text()).toBe('Cảnh báo')
        expect(w.html()).toContain('amber')
    })
    it('renders Tạm dừng for paused status', () => {
        const w = mount(StatusBadge, { props: { status: 'paused' } })
        expect(w.text()).toBe('Tạm dừng')
    })
    it('uses pill style (rounded-full)', () => {
        const w = mount(StatusBadge, { props: { status: 'running' } })
        expect(w.html()).toContain('rounded-full')
    })
})

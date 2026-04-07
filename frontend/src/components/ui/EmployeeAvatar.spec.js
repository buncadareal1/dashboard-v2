import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmployeeAvatar from './EmployeeAvatar.vue'

describe('EmployeeAvatar', () => {
    it('uses first character of name as initial', () => {
        const w = mount(EmployeeAvatar, { props: { name: 'Nguyễn Văn A' } })
        expect(w.text()).toBe('N')
    })
    it('honors overrideInitial prop', () => {
        const w = mount(EmployeeAvatar, { props: { name: 'Nguyễn Văn A', overrideInitial: 'A' } })
        expect(w.text()).toBe('A')
    })
    it('falls back to ? when name empty', () => {
        const w = mount(EmployeeAvatar, { props: { name: '' } })
        expect(w.text()).toBe('?')
    })
    it('applies size class for sm/md/lg', () => {
        const sm = mount(EmployeeAvatar, { props: { name: 'X', size: 'sm' } })
        const lg = mount(EmployeeAvatar, { props: { name: 'X', size: 'lg' } })
        expect(sm.html()).toContain('h-7')
        expect(lg.html()).toContain('h-12')
    })
})

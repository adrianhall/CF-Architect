/**
 * Component tests for CfServiceShapeUtil.
 *
 * Tests the static properties, default props, prop validators, and
 * rendering methods (component, indicator, toSvg, onResize).
 * Runs in jsdom environment.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Spy on resizeBox so we can verify onResize delegates to it
vi.mock('tldraw', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tldraw')>()
  return { ...actual, resizeBox: vi.fn() }
})

import { CfServiceShapeUtil } from '../../../../src/components/canvas/shapes/CfServiceShapeUtil'
import { CF_SERVICES } from '../../../../src/components/canvas/shapes/cf-services'
import { resizeBox } from 'tldraw'
import type { CfServiceShape } from '../../../../src/components/canvas/shapes/CfServiceShapeUtil'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock shape with the given props. */
function mockShape(overrides: Partial<CfServiceShape['props']> = {}): CfServiceShape {
  const util = new CfServiceShapeUtil({} as never)
  return {
    id: 'shape:test' as CfServiceShape['id'],
    type: 'cf-service',
    typeName: 'shape',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1' as CfServiceShape['index'],
    parentId: 'page:page' as CfServiceShape['parentId'],
    isLocked: false,
    opacity: 1,
    meta: {},
    props: { ...util.getDefaultProps(), ...overrides },
  } as CfServiceShape
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CfServiceShapeUtil', () => {
  afterEach(() => {
    cleanup()
  })

  it('has the correct static type identifier', () => {
    expect(CfServiceShapeUtil.type).toBe('cf-service')
  })

  it('has static props with validators for all shape properties', () => {
    const props = CfServiceShapeUtil.props
    expect(props).toBeDefined()
    expect(props).toHaveProperty('w')
    expect(props).toHaveProperty('h')
    expect(props).toHaveProperty('serviceType')
    expect(props).toHaveProperty('label')
  })

  describe('getDefaultProps', () => {
    it('returns valid default props', () => {
      const util = new CfServiceShapeUtil({} as never)
      const defaults = util.getDefaultProps()

      expect(defaults.w).toBe(140)
      expect(defaults.h).toBe(140)
      expect(defaults.serviceType).toBe('workers')
      expect(defaults.label).toBe('Workers')
    })

    it('default serviceType exists in the service registry', () => {
      const util = new CfServiceShapeUtil({} as never)
      const defaults = util.getDefaultProps()

      const service = CF_SERVICES.find((s) => s.type === defaults.serviceType)
      expect(service).toBeDefined()
    })

    it('default label matches the default service display name', () => {
      const util = new CfServiceShapeUtil({} as never)
      const defaults = util.getDefaultProps()

      const service = CF_SERVICES.find((s) => s.type === defaults.serviceType)
      expect(defaults.label).toBe(service?.displayName)
    })
  })

  describe('capabilities', () => {
    it('canResize returns true', () => {
      const util = new CfServiceShapeUtil({} as never)
      expect(util.canResize()).toBe(true)
    })

    it('canEdit returns true', () => {
      const util = new CfServiceShapeUtil({} as never)
      expect(util.canEdit()).toBe(true)
    })
  })

  describe('shape props for all service types', () => {
    it.each(CF_SERVICES)('service "$type" can be used as a valid serviceType prop', (service) => {
      const util = new CfServiceShapeUtil({} as never)
      const defaults = util.getDefaultProps()

      const props = { ...defaults, serviceType: service.type, label: service.displayName }
      expect(props.serviceType).toBe(service.type)
      expect(props.label).toBe(service.displayName)
      expect(props.w).toBeGreaterThan(0)
      expect(props.h).toBeGreaterThan(0)
    })
  })

  describe('onResize', () => {
    it('delegates to resizeBox', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape()
      const info = {
        initialBounds: { x: 0, y: 0, w: 140, h: 140 },
        scaleX: 2,
        scaleY: 2,
        newPoint: { x: 0, y: 0 },
        handle: 'bottom_right',
        mode: 'resize_bounds',
        initialShape: shape,
      } as unknown as import('tldraw').TLResizeInfo<CfServiceShape>

      util.onResize(shape, info)

      expect(resizeBox).toHaveBeenCalledWith(shape, info)
    })
  })

  describe('component', () => {
    it('renders the service icon with correct src for a known service', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ serviceType: 'd1', label: 'My D1' })
      const jsx = util.component(shape)

      render(jsx)

      const img = screen.getByAltText('D1')
      expect(img).toBeInTheDocument()
      expect(img.getAttribute('src')).toBe('/icons/cf/d1.svg')
    })

    it('renders the service display name', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ serviceType: 'workers', label: 'My Worker' })
      const jsx = util.component(shape)

      render(jsx)

      expect(screen.getByText('Workers')).toBeInTheDocument()
    })

    it('renders the user label', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ serviceType: 'workers', label: 'Auth Service' })
      const jsx = util.component(shape)

      render(jsx)

      expect(screen.getByText('Auth Service')).toBeInTheDocument()
    })

    it('falls back to serviceType string for unknown services', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ serviceType: 'unknown-thing', label: 'test' })
      const jsx = util.component(shape)

      render(jsx)

      // Display name falls back to the raw serviceType key
      expect(screen.getByText('unknown-thing')).toBeInTheDocument()
      // Icon falls back to workers.svg
      const img = screen.getByAltText('unknown-thing')
      expect(img.getAttribute('src')).toBe('/icons/cf/workers.svg')
    })

    it('renders for every registered service type', () => {
      const util = new CfServiceShapeUtil({} as never)

      for (const service of CF_SERVICES) {
        // Use a distinct label so display name and label don't collide
        const shape = mockShape({
          serviceType: service.type,
          label: `label-${service.type}`,
        })
        render(util.component(shape))

        expect(screen.getByText(service.displayName)).toBeInTheDocument()
        expect(screen.getByText(`label-${service.type}`)).toBeInTheDocument()
        const img = screen.getByAltText(service.displayName)
        expect(img.getAttribute('src')).toBe(service.iconPath)

        cleanup()
      }
    })
  })

  describe('indicator', () => {
    it('returns a rect with shape dimensions and rounded corners', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ w: 200, h: 160 })
      const jsx = util.indicator(shape)

      const { container } = render(<svg>{jsx}</svg>)

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()
      expect(rect!.getAttribute('width')).toBe('200')
      expect(rect!.getAttribute('height')).toBe('160')
      expect(rect!.getAttribute('rx')).toBe('8')
      expect(rect!.getAttribute('ry')).toBe('8')
    })
  })

  describe('toSvg', () => {
    it('returns SVG group with background rect, accent strip, icon, name, and label', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ w: 140, h: 140, serviceType: 'kv', label: 'Session Store' })
      const jsx = util.toSvg(shape)

      const { container } = render(<svg>{jsx}</svg>)

      // Background rect
      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBeGreaterThanOrEqual(2)

      // First rect is the background with correct dimensions
      const bg = rects[0]
      expect(bg.getAttribute('width')).toBe('140')
      expect(bg.getAttribute('height')).toBe('140')
      expect(bg.getAttribute('fill')).toBe('#1A1A2E')
      expect(bg.getAttribute('stroke')).toBe('#F6821F')

      // Second rect is the orange accent strip
      const strip = rects[1]
      expect(strip.getAttribute('height')).toBe('4')
      expect(strip.getAttribute('fill')).toBe('#F6821F')

      // Icon image
      const image = container.querySelector('image')
      expect(image).toBeTruthy()
      expect(image!.getAttribute('href')).toBe('/icons/cf/kv.svg')

      // Text elements: display name + label
      const texts = container.querySelectorAll('text')
      expect(texts.length).toBe(2)
      expect(texts[0].textContent).toBe('KV')
      expect(texts[1].textContent).toBe('Session Store')
    })

    it('falls back for unknown service types', () => {
      const util = new CfServiceShapeUtil({} as never)
      const shape = mockShape({ serviceType: 'nonexistent', label: 'test' })
      const jsx = util.toSvg(shape)

      const { container } = render(<svg>{jsx}</svg>)

      const image = container.querySelector('image')
      expect(image!.getAttribute('href')).toBe('/icons/cf/workers.svg')

      const texts = container.querySelectorAll('text')
      expect(texts[0].textContent).toBe('nonexistent')
    })
  })
})

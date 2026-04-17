/**
 * Tests for the Cloudflare service registry (cf-services.ts).
 *
 * Validates the complete service catalogue, helper functions,
 * and data integrity constraints.
 */

import { describe, expect, it } from 'vitest'

import {
  CF_SERVICES,
  getCategories,
  getServiceByType,
  getServicesByCategory,
  type CfServiceCategory,
} from '../../../../../src/components/canvas/shapes/cf-services'

describe('CF_SERVICES registry', () => {
  it('contains exactly 18 services', () => {
    expect(CF_SERVICES).toHaveLength(18)
  })

  it('has no duplicate service types', () => {
    const types = CF_SERVICES.map((s) => s.type)
    const uniqueTypes = new Set(types)
    expect(uniqueTypes.size).toBe(types.length)
  })

  it.each(CF_SERVICES)('service "$type" has all required fields', (service) => {
    expect(service.type).toBeTruthy()
    expect(typeof service.type).toBe('string')
    expect(service.displayName).toBeTruthy()
    expect(typeof service.displayName).toBe('string')
    expect(service.category).toBeTruthy()
    expect(typeof service.category).toBe('string')
    expect(service.iconPath).toBeTruthy()
    expect(service.iconPath).toMatch(/^\/icons\/cf\/.+\.svg$/)
    expect(service.description).toBeTruthy()
    expect(typeof service.description).toBe('string')
  })

  it('contains all expected service types', () => {
    const expectedTypes = [
      'workers',
      'pages',
      'durable-objects',
      'browser-rendering',
      'd1',
      'kv',
      'r2',
      'hyperdrive',
      'vectorize',
      'workers-ai',
      'ai-gateway',
      'stream',
      'images',
      'queues',
      'pub-sub',
      'email-routing',
      'dns',
      'spectrum',
    ]
    const actualTypes = CF_SERVICES.map((s) => s.type)
    for (const expected of expectedTypes) {
      expect(actualTypes).toContain(expected)
    }
  })

  it('every service category is valid', () => {
    const validCategories: CfServiceCategory[] = [
      'compute',
      'storage',
      'ai',
      'media',
      'messaging',
      'networking',
    ]
    for (const service of CF_SERVICES) {
      expect(validCategories).toContain(service.category)
    }
  })
})

describe('getServiceByType', () => {
  it('returns the correct service for a known type', () => {
    const service = getServiceByType('workers')
    expect(service).toBeDefined()
    expect(service!.displayName).toBe('Workers')
    expect(service!.category).toBe('compute')
  })

  it('returns the correct service for d1', () => {
    const service = getServiceByType('d1')
    expect(service).toBeDefined()
    expect(service!.displayName).toBe('D1')
    expect(service!.category).toBe('storage')
  })

  it('returns undefined for an unknown type', () => {
    expect(getServiceByType('nonexistent')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getServiceByType('')).toBeUndefined()
  })
})

describe('getServicesByCategory', () => {
  it('returns compute services', () => {
    const services = getServicesByCategory('compute')
    expect(services.length).toBeGreaterThan(0)
    for (const s of services) {
      expect(s.category).toBe('compute')
    }
    expect(services.map((s) => s.type)).toContain('workers')
    expect(services.map((s) => s.type)).toContain('pages')
  })

  it('returns storage services', () => {
    const services = getServicesByCategory('storage')
    expect(services.length).toBeGreaterThan(0)
    for (const s of services) {
      expect(s.category).toBe('storage')
    }
    expect(services.map((s) => s.type)).toContain('d1')
    expect(services.map((s) => s.type)).toContain('kv')
    expect(services.map((s) => s.type)).toContain('r2')
  })

  it('returns only services in the requested category', () => {
    const categories: CfServiceCategory[] = [
      'compute',
      'storage',
      'ai',
      'media',
      'messaging',
      'networking',
    ]
    for (const cat of categories) {
      const services = getServicesByCategory(cat)
      for (const s of services) {
        expect(s.category).toBe(cat)
      }
    }
  })

  it('returns empty array for a category with cast unknown value', () => {
    const services = getServicesByCategory('nonexistent' as CfServiceCategory)
    expect(services).toHaveLength(0)
  })
})

describe('getCategories', () => {
  it('returns all 6 unique categories', () => {
    const categories = getCategories()
    expect(categories).toHaveLength(6)
    expect(categories).toContain('compute')
    expect(categories).toContain('storage')
    expect(categories).toContain('ai')
    expect(categories).toContain('media')
    expect(categories).toContain('messaging')
    expect(categories).toContain('networking')
  })

  it('returns categories in display order', () => {
    const categories = getCategories()
    expect(categories[0]).toBe('compute')
    expect(categories[1]).toBe('storage')
    expect(categories[2]).toBe('ai')
    expect(categories[3]).toBe('media')
    expect(categories[4]).toBe('messaging')
    expect(categories[5]).toBe('networking')
  })

  it('returns a new array each call (not a reference to internal state)', () => {
    const a = getCategories()
    const b = getCategories()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

import { describe, it, expect } from 'vitest'
import type { Selectable } from 'kysely'

import {
  mapDiagramToResponse,
  mapDiagramToListItem,
  mapUserToResponse,
} from '../../../../src/lib/db/mappers'
import type { DiagramsTable, UsersTable } from '../../../../src/lib/db/schema'

// Fixtures use Selectable<T> which resolves Generated<X> → X, matching
// what Kysely actually returns from D1 select queries at runtime.

/** Sample diagram row fixture (snake_case, as returned by D1). */
const DIAGRAM_ROW: Selectable<DiagramsTable> = {
  id: 'diag-001',
  owner_id: 'user-001',
  title: 'My Diagram',
  description: 'A test diagram',
  canvas_data: '{"shapes":[]}',
  thumbnail_svg: '<svg></svg>',
  is_blueprint: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

/** Sample user row fixture (snake_case, as returned by D1). */
const USER_ROW: Selectable<UsersTable> = {
  id: 'user-001',
  github_id: '12345',
  github_username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  role: 'user',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

describe('mapDiagramToResponse', () => {
  it('converts snake_case DB fields to camelCase', () => {
    const result = mapDiagramToResponse(DIAGRAM_ROW)
    expect(result.canvasData).toBe(DIAGRAM_ROW.canvas_data)
    expect(result.thumbnailSvg).toBe(DIAGRAM_ROW.thumbnail_svg)
    expect(result.isBlueprint).toBeDefined()
    expect(result.createdAt).toBe(DIAGRAM_ROW.created_at)
    expect(result.updatedAt).toBe(DIAGRAM_ROW.updated_at)
  })

  it('maps is_blueprint = 0 to false', () => {
    const result = mapDiagramToResponse({ ...DIAGRAM_ROW, is_blueprint: 0 })
    expect(result.isBlueprint).toBe(false)
  })

  it('maps is_blueprint = 1 to true', () => {
    const result = mapDiagramToResponse({ ...DIAGRAM_ROW, is_blueprint: 1 })
    expect(result.isBlueprint).toBe(true)
  })

  it('includes canvasData and thumbnailSvg', () => {
    const result = mapDiagramToResponse(DIAGRAM_ROW)
    expect(result.canvasData).toBe('{"shapes":[]}')
    expect(result.thumbnailSvg).toBe('<svg></svg>')
  })

  it('passes through the supplied tags array', () => {
    const result = mapDiagramToResponse(DIAGRAM_ROW, ['aws', 'network'])
    expect(result.tags).toEqual(['aws', 'network'])
  })

  it('defaults tags to an empty array when omitted', () => {
    const result = mapDiagramToResponse(DIAGRAM_ROW)
    expect(result.tags).toEqual([])
  })

  it('passes through id, title, and description unchanged', () => {
    const result = mapDiagramToResponse(DIAGRAM_ROW)
    expect(result.id).toBe(DIAGRAM_ROW.id)
    expect(result.title).toBe(DIAGRAM_ROW.title)
    expect(result.description).toBe(DIAGRAM_ROW.description)
  })

  it('returns null for thumbnailSvg when the DB field is null', () => {
    const result = mapDiagramToResponse({ ...DIAGRAM_ROW, thumbnail_svg: null })
    expect(result.thumbnailSvg).toBeNull()
  })
})

describe('mapDiagramToListItem', () => {
  it('excludes canvasData', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW)
    expect((result as unknown as Record<string, unknown>).canvasData).toBeUndefined()
  })

  it('excludes thumbnailSvg', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW)
    expect((result as unknown as Record<string, unknown>).thumbnailSvg).toBeUndefined()
  })

  it('excludes isBlueprint', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW)
    expect((result as unknown as Record<string, unknown>).isBlueprint).toBeUndefined()
  })

  it('includes id, title, description, createdAt, updatedAt', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW)
    expect(result.id).toBe(DIAGRAM_ROW.id)
    expect(result.title).toBe(DIAGRAM_ROW.title)
    expect(result.description).toBe(DIAGRAM_ROW.description)
    expect(result.createdAt).toBe(DIAGRAM_ROW.created_at)
    expect(result.updatedAt).toBe(DIAGRAM_ROW.updated_at)
  })

  it('passes through the supplied tags array', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW, ['cdn', 'dns'])
    expect(result.tags).toEqual(['cdn', 'dns'])
  })

  it('defaults tags to an empty array when omitted', () => {
    const result = mapDiagramToListItem(DIAGRAM_ROW)
    expect(result.tags).toEqual([])
  })
})

describe('mapUserToResponse', () => {
  it('converts snake_case DB fields to camelCase', () => {
    const result = mapUserToResponse(USER_ROW)
    expect(result.githubUsername).toBe(USER_ROW.github_username)
    expect(result.displayName).toBe(USER_ROW.display_name)
    expect(result.avatarUrl).toBe(USER_ROW.avatar_url)
    expect(result.createdAt).toBe(USER_ROW.created_at)
  })

  it('passes through id, email, and role unchanged', () => {
    const result = mapUserToResponse(USER_ROW)
    expect(result.id).toBe(USER_ROW.id)
    expect(result.email).toBe(USER_ROW.email)
    expect(result.role).toBe(USER_ROW.role)
  })

  it('excludes updated_at from the response', () => {
    const result = mapUserToResponse(USER_ROW)
    expect((result as unknown as Record<string, unknown>).updatedAt).toBeUndefined()
    expect((result as unknown as Record<string, unknown>).updated_at).toBeUndefined()
  })

  it('returns null for avatarUrl when the DB field is null', () => {
    const result = mapUserToResponse({ ...USER_ROW, avatar_url: null })
    expect(result.avatarUrl).toBeNull()
  })

  it('maps admin role correctly', () => {
    const result = mapUserToResponse({ ...USER_ROW, role: 'admin' })
    expect(result.role).toBe('admin')
  })
})

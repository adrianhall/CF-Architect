/// <reference types="@cloudflare/vitest-pool-workers/types" />
/**
 * Unit tests for blueprint API endpoints (spec §7.2).
 *
 * Tests run in the workerd pool via @cloudflare/vitest-pool-workers.
 * D1 bindings are provided by miniflare.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import type { APIContext } from 'astro'

import { createDb } from '../../../src/lib/db/client'
import type { User } from '../../../src/lib/db/schema'
import type { DiagramResponse, DiagramListItem } from '../../../src/lib/db/mappers'
import { GET as GET_LIST } from '../../../src/pages/api/blueprints/index'
import { GET as GET_BY_ID } from '../../../src/pages/api/blueprints/[id]'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_USER: User = {
  id: 'user-bp-001',
  github_id: '33333',
  github_username: 'bptester',
  email: 'bptester@example.com',
  display_name: 'Blueprint Tester',
  avatar_url: null,
  role: 'user',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed the test user. */
async function seedUser(): Promise<void> {
  const db = createDb(env.DB)
  await db
    .insertInto('users')
    .values({
      id: TEST_USER.id,
      github_id: TEST_USER.github_id,
      github_username: TEST_USER.github_username,
      email: TEST_USER.email,
      display_name: TEST_USER.display_name,
      avatar_url: TEST_USER.avatar_url,
      role: TEST_USER.role,
    })
    .execute()
}

/** Insert a diagram (optionally as blueprint) into D1. */
async function seedDiagram(overrides: {
  id: string
  ownerId: string
  title?: string
  description?: string
  canvasData?: string
  isBlueprint?: number
  tags?: string[]
}): Promise<void> {
  const db = createDb(env.DB)
  await db
    .insertInto('diagrams')
    .values({
      id: overrides.id,
      owner_id: overrides.ownerId,
      title: overrides.title ?? 'Blueprint',
      description: overrides.description ?? '',
      canvas_data: overrides.canvasData ?? '{"blueprint":true}',
      thumbnail_svg: null,
      is_blueprint: overrides.isBlueprint ?? 0,
    })
    .execute()

  if (overrides.tags && overrides.tags.length > 0) {
    await db
      .insertInto('diagram_tags')
      .values(
        overrides.tags.map((tag) => ({
          id: crypto.randomUUID(),
          diagram_id: overrides.id,
          tag,
        })),
      )
      .execute()
  }
}

/** Build a mock APIContext. */
function mockContext(options: {
  url?: string
  params?: Record<string, string>
  user?: User | null
}): APIContext {
  const url = new URL(options.url ?? 'http://localhost:4321/api/blueprints')
  const request = new Request(url.toString(), { method: 'GET' })

  return {
    params: options.params ?? {},
    request,
    url,
    locals: { user: 'user' in options ? options.user! : TEST_USER },
  } as unknown as APIContext
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  const db = createDb(env.DB)
  await db.deleteFrom('diagram_tags').execute()
  await db.deleteFrom('share_tokens').execute()
  await db.deleteFrom('diagrams').execute()
  await db.deleteFrom('users').execute()
  await seedUser()
})

// ---------------------------------------------------------------------------
// GET /api/blueprints — List
// ---------------------------------------------------------------------------

describe('GET /api/blueprints', () => {
  it('returns 401 when user is null', async () => {
    const ctx = mockContext({ user: null })
    const res = await GET_LIST(ctx)
    expect(res.status).toBe(401)
  })

  it('returns only diagrams with is_blueprint = 1', async () => {
    await seedDiagram({ id: 'bp-1', ownerId: TEST_USER.id, title: 'Blueprint A', isBlueprint: 1 })
    await seedDiagram({ id: 'reg-1', ownerId: TEST_USER.id, title: 'Regular', isBlueprint: 0 })

    const ctx = mockContext({})
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Blueprint A')
  })

  it('returns blueprints regardless of owner', async () => {
    // Blueprint owned by a different user is still visible
    const db = createDb(env.DB)
    await db
      .insertInto('users')
      .values({
        id: 'bp-owner',
        github_id: '99999',
        github_username: 'bpowner',
        email: 'bpowner@example.com',
        display_name: 'BP Owner',
        avatar_url: null,
        role: 'admin',
      })
      .execute()
    await seedDiagram({
      id: 'bp-other-owner',
      ownerId: 'bp-owner',
      title: 'Other Blueprint',
      isBlueprint: 1,
    })

    const ctx = mockContext({})
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Other Blueprint')
  })

  it('paginates blueprint results', async () => {
    for (let i = 0; i < 5; i++) {
      await seedDiagram({
        id: `bp-page-${i}`,
        ownerId: TEST_USER.id,
        title: `Blueprint ${i}`,
        isBlueprint: 1,
      })
    }

    const ctx = mockContext({ url: 'http://localhost:4321/api/blueprints?page=1&limit=3' })
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as {
      data: DiagramListItem[]
      pagination: { total: number; totalPages: number }
    }
    expect(body.data).toHaveLength(3)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.totalPages).toBe(2)
  })

  it('filters by search term', async () => {
    await seedDiagram({
      id: 'bp-s1',
      ownerId: TEST_USER.id,
      title: 'Full-Stack Starter',
      isBlueprint: 1,
    })
    await seedDiagram({
      id: 'bp-s2',
      ownerId: TEST_USER.id,
      title: 'API Only',
      isBlueprint: 1,
    })

    const ctx = mockContext({ url: 'http://localhost:4321/api/blueprints?search=starter' })
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Full-Stack Starter')
  })

  it('filters by tag', async () => {
    await seedDiagram({
      id: 'bp-tag1',
      ownerId: TEST_USER.id,
      title: 'Tagged BP',
      isBlueprint: 1,
      tags: ['starter'],
    })
    await seedDiagram({
      id: 'bp-tag2',
      ownerId: TEST_USER.id,
      title: 'Untagged BP',
      isBlueprint: 1,
    })

    const ctx = mockContext({ url: 'http://localhost:4321/api/blueprints?tag=starter' })
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Tagged BP')
  })

  it('deduplicates repeated tag query params', async () => {
    await seedDiagram({
      id: 'bp-dup-tag',
      ownerId: TEST_USER.id,
      title: 'Dup Tag BP',
      isBlueprint: 1,
      tags: ['starter'],
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/blueprints?tag=starter&tag=starter',
    })
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Dup Tag BP')
  })

  it('defaults sort to title asc', async () => {
    await seedDiagram({
      id: 'bp-z',
      ownerId: TEST_USER.id,
      title: 'Zebra Blueprint',
      isBlueprint: 1,
    })
    await seedDiagram({
      id: 'bp-a',
      ownerId: TEST_USER.id,
      title: 'Alpha Blueprint',
      isBlueprint: 1,
    })

    const ctx = mockContext({})
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data[0].title).toBe('Alpha Blueprint')
    expect(body.data[1].title).toBe('Zebra Blueprint')
  })

  it('includes tags in list items', async () => {
    await seedDiagram({
      id: 'bp-with-tags',
      ownerId: TEST_USER.id,
      title: 'BP Tags',
      isBlueprint: 1,
      tags: ['react', 'workers'],
    })

    const ctx = mockContext({})
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data[0].tags).toContain('react')
    expect(body.data[0].tags).toContain('workers')
  })

  it('returns empty list when no blueprints exist', async () => {
    const ctx = mockContext({})
    const res = await GET_LIST(ctx)
    const body = (await res.json()) as {
      data: DiagramListItem[]
      pagination: { total: number }
    }
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/blueprints/[id] — Single
// ---------------------------------------------------------------------------

describe('GET /api/blueprints/[id]', () => {
  it('returns blueprint with canvasData for cloning', async () => {
    await seedDiagram({
      id: 'bp-single',
      ownerId: TEST_USER.id,
      title: 'Clone Me',
      canvasData: '{"clone":"data"}',
      isBlueprint: 1,
      tags: ['starter'],
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/blueprints/bp-single',
      params: { id: 'bp-single' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.title).toBe('Clone Me')
    expect(body.canvasData).toBe('{"clone":"data"}')
    expect(body.isBlueprint).toBe(true)
    expect(body.tags).toEqual(['starter'])
  })

  it('returns 404 for a non-blueprint diagram', async () => {
    await seedDiagram({
      id: 'not-bp',
      ownerId: TEST_USER.id,
      title: 'Regular Diagram',
      isBlueprint: 0,
    })

    const ctx = mockContext({
      params: { id: 'not-bp' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 400 when id param is missing', async () => {
    const ctx = mockContext({ params: {} })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent ID', async () => {
    const ctx = mockContext({
      params: { id: 'nonexistent' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({
      params: { id: 'any' },
      user: null,
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(401)
  })
})

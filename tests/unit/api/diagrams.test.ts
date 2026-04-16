/// <reference types="@cloudflare/vitest-pool-workers/types" />
/**
 * Unit tests for diagram API endpoints (spec §7.1).
 *
 * Tests run in the workerd pool via @cloudflare/vitest-pool-workers.
 * D1 and KV bindings are provided by miniflare; we call the exported
 * endpoint functions directly with mock APIContext objects.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import type { APIContext } from 'astro'

import { createDb } from '../../../src/lib/db/client'
import type { User } from '../../../src/lib/db/schema'
import type { DiagramResponse, DiagramListItem } from '../../../src/lib/db/mappers'
import { GET, POST } from '../../../src/pages/api/diagrams/index'
import { GET as GET_BY_ID, PUT, DELETE } from '../../../src/pages/api/diagrams/[id]'
import { GET as GET_THUMBNAIL } from '../../../src/pages/api/diagrams/[id]/thumbnail'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_USER: User = {
  id: 'user-diag-001',
  github_id: '11111',
  github_username: 'diagtester',
  email: 'diagtester@example.com',
  display_name: 'Diagram Tester',
  avatar_url: null,
  role: 'user',
}

const OTHER_USER: User = {
  id: 'user-diag-002',
  github_id: '22222',
  github_username: 'otheruser',
  email: 'other@example.com',
  display_name: 'Other User',
  avatar_url: null,
  role: 'user',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Insert test users into D1. */
async function seedUsers(): Promise<void> {
  const db = createDb(env.DB)
  for (const u of [TEST_USER, OTHER_USER]) {
    await db
      .insertInto('users')
      .values({
        id: u.id,
        github_id: u.github_id,
        github_username: u.github_username,
        email: u.email,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        role: u.role,
      })
      .execute()
  }
}

/** Insert a diagram directly into D1 for testing reads/updates/deletes. */
async function seedDiagram(overrides: {
  id: string
  ownerId: string
  title?: string
  description?: string
  canvasData?: string
  thumbnailSvg?: string | null
  isBlueprint?: number
  tags?: string[]
}): Promise<void> {
  const db = createDb(env.DB)
  await db
    .insertInto('diagrams')
    .values({
      id: overrides.id,
      owner_id: overrides.ownerId,
      title: overrides.title ?? 'Test Diagram',
      description: overrides.description ?? '',
      canvas_data: overrides.canvasData ?? '{}',
      thumbnail_svg: overrides.thumbnailSvg ?? null,
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

/**
 * Build a mock Astro APIContext with the subset of fields our endpoints use.
 * Cast through unknown to satisfy the full APIContext type without
 * implementing every property.
 */
function mockContext(options: {
  method?: string
  url?: string
  params?: Record<string, string>
  user?: User | null
  body?: unknown
  contentType?: string
  contentLength?: string
}): APIContext {
  const method = options.method ?? 'GET'
  const url = new URL(options.url ?? 'http://localhost:4321/api/diagrams')
  const headers = new Headers()
  if (options.contentType) headers.set('Content-Type', options.contentType)
  if (options.contentLength) headers.set('Content-Length', options.contentLength)

  const requestInit: RequestInit = { method, headers }
  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body)
    // Set Content-Length to match the body if not explicitly provided
    if (!options.contentLength) {
      headers.set(
        'Content-Length',
        String(new TextEncoder().encode(JSON.stringify(options.body)).byteLength),
      )
    }
  }

  const request = new Request(url.toString(), requestInit)

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
  await seedUsers()
})

// ---------------------------------------------------------------------------
// GET /api/diagrams — List
// ---------------------------------------------------------------------------

describe('GET /api/diagrams', () => {
  it('returns 401 when user is null', async () => {
    const ctx = mockContext({ user: null })
    const res = await GET(ctx)
    expect(res.status).toBe(401)
  })

  it('returns empty list for user with no diagrams', async () => {
    const ctx = mockContext({})
    const res = await GET(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: DiagramListItem[]
      pagination: { total: number }
    }
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })

  it("returns only the current user's diagrams", async () => {
    await seedDiagram({ id: 'diag-own', ownerId: TEST_USER.id, title: 'My Diagram' })
    await seedDiagram({ id: 'diag-other', ownerId: OTHER_USER.id, title: 'Other Diagram' })

    const ctx = mockContext({})
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('My Diagram')
  })

  it('paginates results correctly', async () => {
    // Seed 5 diagrams
    for (let i = 0; i < 5; i++) {
      await seedDiagram({ id: `diag-page-${i}`, ownerId: TEST_USER.id, title: `Diagram ${i}` })
    }

    const ctx = mockContext({ url: 'http://localhost:4321/api/diagrams?page=2&limit=2' })
    const res = await GET(ctx)
    const body = (await res.json()) as {
      data: DiagramListItem[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(body.data).toHaveLength(2)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.totalPages).toBe(3)
  })

  it('filters by search term in title', async () => {
    await seedDiagram({ id: 'diag-s1', ownerId: TEST_USER.id, title: 'Production Architecture' })
    await seedDiagram({ id: 'diag-s2', ownerId: TEST_USER.id, title: 'Staging Setup' })

    const ctx = mockContext({ url: 'http://localhost:4321/api/diagrams?search=production' })
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Production Architecture')
  })

  it('filters by search term in description', async () => {
    await seedDiagram({
      id: 'diag-d1',
      ownerId: TEST_USER.id,
      title: 'Diagram A',
      description: 'Uses CloudFront CDN',
    })
    await seedDiagram({
      id: 'diag-d2',
      ownerId: TEST_USER.id,
      title: 'Diagram B',
      description: 'Simple setup',
    })

    const ctx = mockContext({ url: 'http://localhost:4321/api/diagrams?search=cloudfront' })
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Diagram A')
  })

  it('filters by tag (AND semantics)', async () => {
    await seedDiagram({
      id: 'diag-t1',
      ownerId: TEST_USER.id,
      title: 'Tagged Both',
      tags: ['aws', 'cdn'],
    })
    await seedDiagram({
      id: 'diag-t2',
      ownerId: TEST_USER.id,
      title: 'Tagged One',
      tags: ['aws'],
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/diagrams?tag=aws&tag=cdn',
    })
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Tagged Both')
  })

  it('deduplicates repeated tag query params', async () => {
    await seedDiagram({
      id: 'diag-dup-tag',
      ownerId: TEST_USER.id,
      title: 'Dup Tag',
      tags: ['aws'],
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/diagrams?tag=aws&tag=aws',
    })
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Dup Tag')
  })

  it('includes tags in list items', async () => {
    await seedDiagram({
      id: 'diag-tags',
      ownerId: TEST_USER.id,
      title: 'With Tags',
      tags: ['alpha', 'beta'],
    })

    const ctx = mockContext({})
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data[0].tags).toContain('alpha')
    expect(body.data[0].tags).toContain('beta')
  })

  it('excludes canvasData and thumbnailSvg from list items', async () => {
    await seedDiagram({
      id: 'diag-excl',
      ownerId: TEST_USER.id,
      canvasData: '{"big":"data"}',
      thumbnailSvg: '<svg>big</svg>',
    })

    const ctx = mockContext({})
    const res = await GET(ctx)
    const body = (await res.json()) as { data: Record<string, unknown>[] }
    expect(body.data[0].canvasData).toBeUndefined()
    expect(body.data[0].thumbnailSvg).toBeUndefined()
  })

  it('respects sort and order params', async () => {
    await seedDiagram({ id: 'diag-z', ownerId: TEST_USER.id, title: 'Zebra' })
    await seedDiagram({ id: 'diag-a', ownerId: TEST_USER.id, title: 'Aardvark' })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/diagrams?sort=title&order=asc',
    })
    const res = await GET(ctx)
    const body = (await res.json()) as { data: DiagramListItem[] }
    expect(body.data[0].title).toBe('Aardvark')
    expect(body.data[1].title).toBe('Zebra')
  })
})

// ---------------------------------------------------------------------------
// POST /api/diagrams — Create
// ---------------------------------------------------------------------------

describe('POST /api/diagrams', () => {
  it('creates a diagram and returns 201', async () => {
    const ctx = mockContext({
      method: 'POST',
      url: 'http://localhost:4321/api/diagrams',
      contentType: 'application/json',
      body: { title: 'New Diagram', canvasData: '{"shapes":[]}', tags: ['test'] },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(201)
    const body = (await res.json()) as DiagramResponse
    expect(body.title).toBe('New Diagram')
    expect(body.canvasData).toBe('{"shapes":[]}')
    expect(body.tags).toEqual(['test'])
    expect(body.id).toBeDefined()
    expect(body.createdAt).toBeDefined()
    expect(body.isBlueprint).toBe(false)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      body: { title: 'X', canvasData: '{}' },
      user: null,
    })
    const res = await POST(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 415 when Content-Type is missing', async () => {
    const ctx = mockContext({
      method: 'POST',
      body: { title: 'X', canvasData: '{}' },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(415)
  })

  it('returns 413 when body exceeds 1 MB', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      contentLength: '2000000',
      body: { title: 'X', canvasData: '{}' },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(413)
  })

  it('returns 400 when title is missing', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      body: { canvasData: '{}' },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const url = new URL('http://localhost:4321/api/diagrams')
    const request = new Request(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '11' },
      body: 'not-json!!!',
    })
    const ctx = {
      params: {},
      request,
      url,
      locals: { user: TEST_USER },
    } as unknown as APIContext
    const res = await POST(ctx)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain('Invalid JSON')
  })

  it('returns 400 when canvasData is invalid JSON', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      body: { title: 'Test', canvasData: 'not-json{' },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(400)
  })

  it('stores tags as lowercase, trimmed', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      body: { title: 'Tag Test', canvasData: '{}', tags: [' AWS ', 'Network'] },
    })
    const res = await POST(ctx)
    expect(res.status).toBe(201)
    const body = (await res.json()) as DiagramResponse
    expect(body.tags).toEqual(['aws', 'network'])
  })

  it('defaults description to empty string', async () => {
    const ctx = mockContext({
      method: 'POST',
      contentType: 'application/json',
      body: { title: 'No Desc', canvasData: '{}' },
    })
    const res = await POST(ctx)
    const body = (await res.json()) as DiagramResponse
    expect(body.description).toBe('')
  })
})

// ---------------------------------------------------------------------------
// GET /api/diagrams/[id] — Single
// ---------------------------------------------------------------------------

describe('GET /api/diagrams/[id]', () => {
  it('returns an owned diagram', async () => {
    await seedDiagram({
      id: 'diag-get-1',
      ownerId: TEST_USER.id,
      title: 'Get Me',
      canvasData: '{"test":true}',
      tags: ['tag1'],
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/diagrams/diag-get-1',
      params: { id: 'diag-get-1' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.title).toBe('Get Me')
    expect(body.canvasData).toBe('{"test":true}')
    expect(body.tags).toEqual(['tag1'])
  })

  it('returns 404 for non-existent diagram', async () => {
    const ctx = mockContext({
      params: { id: 'nonexistent' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 400 when id param is missing', async () => {
    const ctx = mockContext({ params: {} })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(400)
  })

  it("returns 404 for another user's diagram", async () => {
    await seedDiagram({ id: 'diag-other-get', ownerId: OTHER_USER.id })

    const ctx = mockContext({
      params: { id: 'diag-other-get' },
    })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({ params: { id: 'any' }, user: null })
    const res = await GET_BY_ID(ctx)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// PUT /api/diagrams/[id] — Update
// ---------------------------------------------------------------------------

describe('PUT /api/diagrams/[id]', () => {
  it('updates diagram fields and returns 200', async () => {
    await seedDiagram({
      id: 'diag-put-1',
      ownerId: TEST_USER.id,
      title: 'Original',
      canvasData: '{}',
    })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-1' },
      body: { title: 'Updated Title', description: 'New desc' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.title).toBe('Updated Title')
    expect(body.description).toBe('New desc')
  })

  it('replaces all tags on update', async () => {
    await seedDiagram({
      id: 'diag-put-tags',
      ownerId: TEST_USER.id,
      tags: ['old1', 'old2'],
    })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-tags' },
      body: { tags: ['new1', 'new2', 'new3'] },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.tags.sort()).toEqual(['new1', 'new2', 'new3'])
  })

  it('clears all tags when empty array is provided', async () => {
    await seedDiagram({
      id: 'diag-put-clear',
      ownerId: TEST_USER.id,
      tags: ['will-be-removed'],
    })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-clear' },
      body: { tags: [] },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.tags).toEqual([])
  })

  it('leaves tags unchanged when tags field is omitted', async () => {
    await seedDiagram({
      id: 'diag-put-keep',
      ownerId: TEST_USER.id,
      tags: ['kept'],
    })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-keep' },
      body: { title: 'New Title' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.tags).toEqual(['kept'])
  })

  it('returns 400 when id param is missing', async () => {
    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: {},
      body: { title: 'X' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when request body is not valid JSON', async () => {
    // Construct a request whose .json() will reject
    const url = new URL('http://localhost:4321/api/diagrams/diag-bad-json')
    const request = new Request(url.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '11' },
      body: 'not-json!!!',
    })
    const ctx = {
      params: { id: 'diag-bad-json' },
      request,
      url,
      locals: { user: TEST_USER },
    } as unknown as APIContext
    const res = await PUT(ctx)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain('Invalid JSON')
  })

  it('invalidates share cache when canvasData is updated', async () => {
    await seedDiagram({
      id: 'diag-put-cache',
      ownerId: TEST_USER.id,
      canvasData: '{"old":true}',
    })
    // Seed a share token for this diagram
    const db = createDb(env.DB)
    const token = 'testtokentesttokentest24'
    await db
      .insertInto('share_tokens')
      .values({
        id: crypto.randomUUID(),
        diagram_id: 'diag-put-cache',
        token,
        created_by: TEST_USER.id,
        expires_at: null,
      })
      .execute()
    // Pre-populate KV cache for the token
    await env.CACHE.put(`share:${token}`, '{"cached":true}')

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-cache' },
      body: { canvasData: '{"new":true}' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)

    // Verify KV cache was invalidated
    const cached = await env.CACHE.get(`share:${token}`)
    expect(cached).toBeNull()
  })

  it('returns 404 for non-existent diagram', async () => {
    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'nonexistent' },
      body: { title: 'X' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(404)
  })

  it("returns 403 for another user's diagram", async () => {
    await seedDiagram({ id: 'diag-put-other', ownerId: OTHER_USER.id })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-other' },
      body: { title: 'Hijack' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(403)
  })

  it('returns 413 when body exceeds 1 MB', async () => {
    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      contentLength: '2000000',
      params: { id: 'any' },
      body: { title: 'X' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(413)
  })

  it('updates thumbnailSvg field', async () => {
    await seedDiagram({ id: 'diag-put-thumb', ownerId: TEST_USER.id })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-thumb' },
      body: { thumbnailSvg: '<svg><rect/></svg>' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as DiagramResponse
    expect(body.thumbnailSvg).toBe('<svg><rect/></svg>')
  })

  it('returns 415 when Content-Type is missing', async () => {
    const ctx = mockContext({
      method: 'PUT',
      params: { id: 'any' },
      body: { title: 'X' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(415)
  })

  it('returns 400 for invalid update body', async () => {
    await seedDiagram({ id: 'diag-put-bad', ownerId: TEST_USER.id })

    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'diag-put-bad' },
      body: { canvasData: 'not-json{' },
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({
      method: 'PUT',
      contentType: 'application/json',
      params: { id: 'any' },
      body: {},
      user: null,
    })
    const res = await PUT(ctx)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/diagrams/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/diagrams/[id]', () => {
  it('returns 204 and removes the diagram', async () => {
    await seedDiagram({ id: 'diag-del-1', ownerId: TEST_USER.id })

    const ctx = mockContext({
      method: 'DELETE',
      params: { id: 'diag-del-1' },
    })
    const res = await DELETE(ctx)
    expect(res.status).toBe(204)

    // Verify it is gone
    const db = createDb(env.DB)
    const row = await db
      .selectFrom('diagrams')
      .selectAll()
      .where('id', '=', 'diag-del-1')
      .executeTakeFirst()
    expect(row).toBeUndefined()
  })

  it('returns 400 when id param is missing', async () => {
    const ctx = mockContext({
      method: 'DELETE',
      params: {},
    })
    const res = await DELETE(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 204 for non-existent diagram (idempotent)', async () => {
    const ctx = mockContext({
      method: 'DELETE',
      params: { id: 'never-existed' },
    })
    const res = await DELETE(ctx)
    expect(res.status).toBe(204)
  })

  it("returns 403 for another user's diagram", async () => {
    await seedDiagram({ id: 'diag-del-other', ownerId: OTHER_USER.id })

    const ctx = mockContext({
      method: 'DELETE',
      params: { id: 'diag-del-other' },
    })
    const res = await DELETE(ctx)
    expect(res.status).toBe(403)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({
      method: 'DELETE',
      params: { id: 'any' },
      user: null,
    })
    const res = await DELETE(ctx)
    expect(res.status).toBe(401)
  })

  it('cascades deletion to diagram_tags', async () => {
    await seedDiagram({
      id: 'diag-del-cascade',
      ownerId: TEST_USER.id,
      tags: ['tag1', 'tag2'],
    })

    const ctx = mockContext({
      method: 'DELETE',
      params: { id: 'diag-del-cascade' },
    })
    await DELETE(ctx)

    const db = createDb(env.DB)
    const tags = await db
      .selectFrom('diagram_tags')
      .selectAll()
      .where('diagram_id', '=', 'diag-del-cascade')
      .execute()
    expect(tags).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/diagrams/[id]/thumbnail
// ---------------------------------------------------------------------------

describe('GET /api/diagrams/[id]/thumbnail', () => {
  it('returns 400 when id param is missing', async () => {
    const ctx = mockContext({ params: {} })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(400)
  })

  it('returns SVG with correct headers', async () => {
    await seedDiagram({
      id: 'diag-thumb-1',
      ownerId: TEST_USER.id,
      thumbnailSvg: '<svg><rect/></svg>',
    })

    const ctx = mockContext({
      url: 'http://localhost:4321/api/diagrams/diag-thumb-1/thumbnail',
      params: { id: 'diag-thumb-1' },
    })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    )
    const body = await res.text()
    expect(body).toBe('<svg><rect/></svg>')
  })

  it('returns 404 when diagram has no thumbnail', async () => {
    await seedDiagram({
      id: 'diag-thumb-none',
      ownerId: TEST_USER.id,
      thumbnailSvg: null,
    })

    const ctx = mockContext({
      params: { id: 'diag-thumb-none' },
    })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 404 for non-existent diagram', async () => {
    const ctx = mockContext({
      params: { id: 'nonexistent' },
    })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(404)
  })

  it("returns 404 for another user's diagram", async () => {
    await seedDiagram({
      id: 'diag-thumb-other',
      ownerId: OTHER_USER.id,
      thumbnailSvg: '<svg/>',
    })

    const ctx = mockContext({
      params: { id: 'diag-thumb-other' },
    })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 when user is null', async () => {
    const ctx = mockContext({
      params: { id: 'any' },
      user: null,
    })
    const res = await GET_THUMBNAIL(ctx)
    expect(res.status).toBe(401)
  })
})

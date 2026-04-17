/**
 * Service selector toolbar for the canvas editor (spec §4.5).
 *
 * A collapsible left sidebar panel that overlays the tldraw canvas,
 * listing all Cloudflare Developer Platform services grouped by category.
 * Users can drag services from the toolbar onto the canvas to create
 * `cf-service` shapes.
 *
 * Registered as tldraw's `InFrontOfTheCanvas` component.
 *
 * Drag implementation follows tldraw's official pointer-capture pattern.
 * Ref: https://tldraw.dev/examples/drag-and-drop-tray
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { Vec, useEditor } from 'tldraw'

import {
  getCategories,
  getServicesByCategory,
  type CfServiceCategory,
  type CfServiceDefinition,
} from './shapes/cf-services'

// ---------------------------------------------------------------------------
// Drag state machine
// ---------------------------------------------------------------------------

/** Drag interaction states. */
type DragState =
  | { name: 'idle' }
  | { name: 'pointing'; service: CfServiceDefinition; startPosition: Vec }
  | { name: 'dragging'; service: CfServiceDefinition; currentPosition: Vec }

/** Minimum pixel distance before a pointer-down becomes a drag. */
const DRAG_THRESHOLD = 8

// ---------------------------------------------------------------------------
// Category display labels
// ---------------------------------------------------------------------------

/** Human-readable labels for service categories. */
const CATEGORY_LABELS: Record<CfServiceCategory, string> = {
  compute: 'Compute',
  storage: 'Storage',
  ai: 'AI',
  media: 'Media',
  messaging: 'Messaging',
  networking: 'Networking',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Service selector toolbar rendered in front of the tldraw canvas.
 *
 * Features:
 * - Collapsible left sidebar with toggle button
 * - Services grouped by category headings
 * - Text search/filter
 * - Pointer-capture drag to create shapes on the canvas
 */
export function ServiceToolbar() {
  const editor = useEditor()
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const dragStateRef = useRef<DragState>({ name: 'idle' })
  const [dragPreview, setDragPreview] = useState<{
    visible: boolean
    x: number
    y: number
    service: CfServiceDefinition | null
  }>({ visible: false, x: 0, y: 0, service: null })

  // Filtered services based on search
  const categories = useMemo(() => {
    const cats = getCategories()
    const searchLower = search.toLowerCase()

    return cats
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        services: getServicesByCategory(cat).filter(
          (s) =>
            search === '' ||
            s.displayName.toLowerCase().includes(searchLower) ||
            s.description.toLowerCase().includes(searchLower),
        ),
      }))
      .filter((group) => group.services.length > 0)
  }, [search])

  // -----------------------------------------------------------------------
  // Drag handlers — pointer-capture pattern
  // -----------------------------------------------------------------------

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = dragStateRef.current
    const screenPoint = new Vec(e.clientX, e.clientY)

    if (state.name === 'pointing') {
      const dist = Vec.Dist(screenPoint, state.startPosition)
      if (dist > DRAG_THRESHOLD) {
        dragStateRef.current = {
          name: 'dragging',
          service: state.service,
          currentPosition: screenPoint,
        }
        setDragPreview({ visible: true, x: e.clientX, y: e.clientY, service: state.service })
      }
    } else if (state.name === 'dragging') {
      dragStateRef.current = { ...state, currentPosition: screenPoint }
      setDragPreview((prev) => ({ ...prev, x: e.clientX, y: e.clientY }))
    }
  }, [])

  const cleanup = useCallback(
    (target: HTMLElement) => {
      target.removeEventListener('pointermove', handlePointerMove)
      dragStateRef.current = { name: 'idle' }
      setDragPreview({ visible: false, x: 0, y: 0, service: null })
    },
    [handlePointerMove],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, service: CfServiceDefinition) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      dragStateRef.current = {
        name: 'pointing',
        service,
        startPosition: new Vec(e.clientX, e.clientY),
      }

      target.addEventListener('pointermove', handlePointerMove)
    },
    [handlePointerMove],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement
      target.releasePointerCapture(e.pointerId)

      const state = dragStateRef.current
      if (state.name === 'dragging') {
        // Convert screen coords to canvas page coords and create the shape
        const screenPoint = new Vec(e.clientX, e.clientY)
        const pagePoint = editor.screenToPage(screenPoint)

        editor.markHistoryStoppingPoint('create cf-service shape')
        editor.createShape({
          type: 'cf-service',
          x: pagePoint.x - 70, // Centre on cursor (half of 140 default width)
          y: pagePoint.y - 70,
          props: {
            serviceType: state.service.type,
            label: state.service.displayName,
          },
        })
      }

      cleanup(target)
    },
    [editor, cleanup],
  )

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Open service toolbar' : 'Close service toolbar'}
        aria-label={collapsed ? 'Open service toolbar' : 'Close service toolbar'}
        style={{
          position: 'absolute',
          top: '60px',
          left: collapsed ? '8px' : '248px',
          zIndex: 1000,
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)',
          backgroundColor: '#1A1A2E',
          color: '#F6821F',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'left 0.2s ease',
        }}
      >
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>

      {/* Sidebar panel */}
      {!collapsed && (
        <div
          data-testid="service-toolbar"
          style={{
            position: 'absolute',
            top: '56px',
            left: '8px',
            width: '240px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            backgroundColor: '#1A1A2E',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 999,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {/* Search input */}
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search services"
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '4px',
            }}
          />

          {/* Service groups */}
          {categories.map((group) => (
            <div key={group.category}>
              {/* Category heading */}
              <div
                style={{
                  color: '#F6821F',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 4px 2px',
                }}
              >
                {group.label}
              </div>

              {/* Service items */}
              {group.services.map((service) => (
                <div
                  key={service.type}
                  data-testid={`service-item-${service.type}`}
                  title={service.description}
                  onPointerDown={(e) => handlePointerDown(e, service)}
                  onPointerUp={handlePointerUp}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'grab',
                    userSelect: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor =
                      'rgba(246, 130, 31, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  }}
                >
                  <img
                    src={service.iconPath}
                    alt=""
                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                    draggable={false}
                  />
                  <span>{service.displayName}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Empty state */}
          {categories.length === 0 && (
            <div
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                padding: '16px 8px',
                textAlign: 'center',
              }}
            >
              No services match &quot;{search}&quot;
            </div>
          )}
        </div>
      )}

      {/* Drag preview ghost */}
      {dragPreview.visible && dragPreview.service && (
        <div
          style={{
            position: 'fixed',
            left: dragPreview.x - 25,
            top: dragPreview.y - 25,
            width: '50px',
            height: '50px',
            pointerEvents: 'none',
            zIndex: 10000,
            opacity: 0.8,
          }}
        >
          <img
            src={dragPreview.service.iconPath}
            alt={dragPreview.service.displayName}
            style={{ width: '100%', height: '100%' }}
            draggable={false}
          />
        </div>
      )}
    </>
  )
}

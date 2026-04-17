/**
 * Main canvas editor component (spec §4.2).
 *
 * Renders the tldraw canvas with custom Cloudflare service shapes,
 * the service selector toolbar, and a custom top bar overlay with
 * title, description, save controls, and navigation.
 *
 * This component is rendered as a React island via `client:only="react"`
 * in the Astro canvas pages.
 */

import { useCallback, useState } from 'react'
import {
  Tldraw,
  type Editor,
  type TLEditorComponents,
  type TLStoreSnapshot,
  loadSnapshot,
} from 'tldraw'
import 'tldraw/tldraw.css'

import { CfServiceShapeUtil } from './shapes/CfServiceShapeUtil'
import { ServiceToolbar } from './ServiceToolbar'
import { useAutoSave, type SaveStatus } from './useAutoSave'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the CanvasEditor component. */
interface CanvasEditorProps {
  /** Existing diagram ID (edit mode). */
  diagramId?: string
  /** JSON string of tldraw document snapshot to load. */
  initialData?: string
  /** JSON string of a blueprint document snapshot to clone. */
  blueprintData?: string
  /** Existing title. */
  title?: string
  /** Existing description. */
  description?: string
}

// ---------------------------------------------------------------------------
// Custom shape registration
// ---------------------------------------------------------------------------

/** Shape utils passed to the Tldraw component. */
const shapeUtils = [CfServiceShapeUtil]

/** tldraw component overrides — renders the ServiceToolbar in front of the canvas. */
const components: TLEditorComponents = {
  InFrontOfTheCanvas: ServiceToolbar,
}

// ---------------------------------------------------------------------------
// Save status display
// ---------------------------------------------------------------------------

/** Map save status to human-readable label. */
const STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
}

/** Map save status to indicator colour. */
const STATUS_COLORS: Record<SaveStatus, string> = {
  idle: 'transparent',
  saving: '#F6821F',
  saved: '#22c55e',
  error: '#ef4444',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-viewport tldraw canvas editor with custom Cloudflare service shapes.
 *
 * Features:
 * - Custom `cf-service` shapes with service icons
 * - Service selector toolbar (drag to create shapes)
 * - Auto-save (30s debounce) and manual save
 * - Editable title and description
 * - Save status indicator with error banner
 * - Navigation back to dashboard
 *
 * @param props - Editor configuration including diagram data and metadata.
 */
export function CanvasEditor(props: CanvasEditorProps) {
  const { diagramId, initialData, blueprintData, title, description } = props
  const [editor, setEditor] = useState<Editor | null>(null)

  const autoSave = useAutoSave({
    editor,
    diagramId,
    title,
    description,
  })

  /**
   * Handle tldraw mount — store the editor ref and load initial data.
   * Uses tldraw v4 loadSnapshot() standalone function.
   * Ref: https://tldraw.dev/docs/persistence
   */
  const handleMount = useCallback(
    (ed: Editor) => {
      setEditor(ed)

      // Load initial data or blueprint
      const dataToLoad = initialData ?? blueprintData
      if (dataToLoad) {
        try {
          const parsed = JSON.parse(dataToLoad) as TLStoreSnapshot
          loadSnapshot(ed.store, parsed)
        } catch {
          // If data fails to parse, start with empty canvas
          console.warn('Failed to load initial canvas data')
        }
      }
    },
    [initialData, blueprintData],
  )

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Custom top bar overlay */}
      <div
        data-testid="canvas-topbar"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '48px',
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '8px',
          zIndex: 1001,
        }}
      >
        {/* Back button */}
        <a
          href="/"
          data-testid="back-button"
          style={{
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '14px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          }}
        >
          &larr; Back
        </a>

        {/* Title input */}
        <input
          type="text"
          value={autoSave.currentTitle}
          onChange={(e) => autoSave.setTitle(e.target.value)}
          placeholder="Untitled diagram"
          aria-label="Diagram title"
          data-testid="title-input"
          style={{
            flex: 1,
            maxWidth: '300px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: 'transparent',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            outline: 'none',
          }}
        />

        {/* Description input (collapsible — shown inline for now) */}
        <input
          type="text"
          value={autoSave.currentDescription}
          onChange={(e) => autoSave.setDescription(e.target.value)}
          placeholder="Description..."
          aria-label="Diagram description"
          data-testid="description-input"
          style={{
            flex: 1,
            maxWidth: '200px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.15)',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '12px',
            outline: 'none',
          }}
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Save status indicator */}
        {autoSave.status !== 'idle' && (
          <span
            data-testid="save-status"
            style={{
              fontSize: '12px',
              color: STATUS_COLORS[autoSave.status],
            }}
          >
            {STATUS_LABELS[autoSave.status]}
          </span>
        )}

        {/* Save button */}
        <button
          onClick={autoSave.saveNow}
          data-testid="save-button"
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#F6821F',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Save
        </button>

        {/* Share button (placeholder for phase 007) */}
        <button
          disabled
          data-testid="share-button"
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            cursor: 'not-allowed',
            flexShrink: 0,
          }}
        >
          Share
        </button>

        {/* Export button (placeholder for phase 007) */}
        <button
          disabled
          data-testid="export-button"
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            cursor: 'not-allowed',
            flexShrink: 0,
          }}
        >
          Export
        </button>
      </div>

      {/* Error banner (persistent on save failure, per spec §14) */}
      {autoSave.status === 'error' && (
        <div
          data-testid="error-banner"
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            right: 0,
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1001,
            fontSize: '13px',
          }}
        >
          <span>{autoSave.errorMessage ?? 'Failed to save diagram'}</span>
          <button
            onClick={autoSave.retry}
            data-testid="retry-button"
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.5)',
              backgroundColor: 'transparent',
              color: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* tldraw canvas */}
      <Tldraw
        shapeUtils={shapeUtils}
        components={components}
        onMount={handleMount}
        acceptedImageMimeTypes={[]}
        acceptedVideoMimeTypes={[]}
      />
    </div>
  )
}

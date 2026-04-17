/**
 * Custom hook for auto-saving tldraw canvas data to the API.
 *
 * Listens to store changes and debounces saves at a configurable interval
 * (default 30 seconds). Handles both new diagram creation (POST) and
 * existing diagram updates (PUT).
 *
 * Extracted from CanvasEditor for independent testability.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { getSnapshot } from 'tldraw'

import { ApiError, fetchApi } from '../../lib/api-client'

/** Possible states for the save status indicator. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Options for the useAutoSave hook. */
export interface UseAutoSaveOptions {
  /** tldraw editor instance (null until mounted). */
  editor: Editor | null
  /** Existing diagram ID, or undefined for new diagrams. */
  diagramId?: string
  /** Initial title for the diagram. */
  title?: string
  /** Initial description for the diagram. */
  description?: string
  /** Debounce interval in milliseconds. Defaults to 30000 (30s). */
  debounceMs?: number
}

/** Return value of the useAutoSave hook. */
export interface UseAutoSaveReturn {
  /** Current save status. */
  status: SaveStatus
  /** Error message from the last failed save, or null. */
  errorMessage: string | null
  /** The current diagram ID (may be set after first save of a new diagram). */
  currentDiagramId: string | undefined
  /** Trigger an immediate save. */
  saveNow: () => void
  /** Retry a failed save. */
  retry: () => void
  /** Current title. */
  currentTitle: string
  /** Update the title (marks diagram as dirty). */
  setTitle: (title: string) => void
  /** Current description. */
  currentDescription: string
  /** Update the description (marks diagram as dirty). */
  setDescription: (description: string) => void
}

/**
 * Hook that manages auto-saving of canvas data to the diagram API.
 *
 * @param options - Configuration including editor instance and diagram metadata.
 * @returns Save state and control functions.
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const { editor, diagramId, title = 'Untitled', description = '', debounceMs = 30_000 } = options

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentDiagramId, setCurrentDiagramId] = useState<string | undefined>(diagramId)
  const [currentTitle, setCurrentTitle] = useState(title)
  const [currentDescription, setCurrentDescription] = useState(description)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  // Refs to access latest values in the save callback without stale closures
  const editorRef = useRef(editor)
  const diagramIdRef = useRef(currentDiagramId)
  const titleRef = useRef(currentTitle)
  const descriptionRef = useRef(currentDescription)

  // Keep refs in sync
  editorRef.current = editor
  diagramIdRef.current = currentDiagramId
  titleRef.current = currentTitle
  descriptionRef.current = currentDescription

  /** Perform the actual save to the API. */
  const performSave = useCallback(async () => {
    const ed = editorRef.current
    if (!ed) return

    setStatus('saving')
    setErrorMessage(null)

    try {
      const { document } = getSnapshot(ed.store)
      const canvasData = JSON.stringify(document)

      if (diagramIdRef.current) {
        // Update existing diagram
        await fetchApi(`/api/diagrams/${diagramIdRef.current}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: titleRef.current,
            description: descriptionRef.current,
            canvasData,
          }),
        })
      } else {
        // Create new diagram
        const result = await fetchApi<{ id: string }>('/api/diagrams', {
          method: 'POST',
          body: JSON.stringify({
            title: titleRef.current,
            description: descriptionRef.current,
            canvasData,
          }),
        })
        setCurrentDiagramId(result.id)

        // Update URL without full navigation
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/canvas/${result.id}`)
        }
      }

      dirtyRef.current = false
      setStatus('saved')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save diagram'
      setErrorMessage(message)
      setStatus('error')
    }
  }, [])

  /** Mark the diagram as dirty and reset the debounce timer. */
  const markDirty = useCallback(() => {
    dirtyRef.current = true

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      if (dirtyRef.current) {
        void performSave()
      }
    }, debounceMs)
  }, [debounceMs, performSave])

  /** Immediately trigger a save. */
  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    void performSave()
  }, [performSave])

  /** Retry a failed save. */
  const retry = useCallback(() => {
    void performSave()
  }, [performSave])

  /** Wrapped setTitle that also marks dirty. */
  const handleSetTitle = useCallback(
    (newTitle: string) => {
      setCurrentTitle(newTitle)
      markDirty()
    },
    [markDirty],
  )

  /** Wrapped setDescription that also marks dirty. */
  const handleSetDescription = useCallback(
    (newDescription: string) => {
      setCurrentDescription(newDescription)
      markDirty()
    },
    [markDirty],
  )

  // Listen to store changes from the editor
  useEffect(() => {
    if (!editor) return

    const unsub = editor.store.listen(
      () => {
        markDirty()
      },
      { source: 'user', scope: 'document' },
    )

    return () => {
      unsub()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [editor, markDirty])

  return {
    status,
    errorMessage,
    currentDiagramId,
    saveNow,
    retry,
    currentTitle,
    setTitle: handleSetTitle,
    currentDescription,
    setDescription: handleSetDescription,
  }
}

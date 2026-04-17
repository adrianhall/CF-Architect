/**
 * DeleteDiagramDialog — a React island that renders a trash-icon button which,
 * on click, opens a confirmation alert dialog before deleting a diagram.
 *
 * On success the page is reloaded so the removed card disappears.
 * On error a sonner toast is shown.
 *
 * Hydrated with `client:load` on each diagram card in the dashboard.
 * Ref: https://ui.shadcn.com/docs/components/alert-dialog
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'
import { fetchApi } from '../../lib/api-client'

/**
 * Props for the DeleteDiagramDialog component.
 */
export interface DeleteDiagramDialogProps {
  /** UUID of the diagram to delete. */
  diagramId: string
  /** Human-readable diagram title shown in the confirmation prompt. */
  diagramTitle: string
}

/**
 * Delete confirmation dialog for diagram cards in the dashboard.
 *
 * Renders a trash-icon button. On click, presents an alert dialog asking
 * the user to confirm deletion. On confirm, calls `DELETE /api/diagrams/{id}`.
 */
export function DeleteDiagramDialog({ diagramId, diagramTitle }: DeleteDiagramDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  /**
   * Handle the confirmed deletion request.
   * Calls the API, shows a toast on error, and reloads on success.
   */
  async function handleDelete() {
    setLoading(true)
    try {
      await fetchApi<void>(`/api/diagrams/${diagramId}`, { method: 'DELETE' })
      // Close the dialog before reload to avoid a flash of open dialog
      setOpen(false)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete diagram'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="text-cf-gray-500 inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:outline-none"
          aria-label={`Delete diagram "${diagramTitle}"`}
          title="Delete diagram"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{diagramTitle}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The diagram and all its data will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Tests for the shadcn/ui AlertDialog React components
 * (`src/components/ui/alert-dialog.tsx`).
 *
 * Uses a controlled `open` prop to render the dialog without needing pointer
 * events, since content is rendered into a Radix portal in document.body.
 * All `screen.*` queries search the entire document including portals.
 *
 * Every rendered `AlertDialogContent` includes an `AlertDialogDescription`
 * to satisfy Radix's accessibility requirement and silence the stderr warning:
 * "AlertDialogContent requires a description for screen reader users."
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
} from '../../../src/components/ui/alert-dialog'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Layout sub-components (pure div wrappers — no AlertDialogContent needed)
// ---------------------------------------------------------------------------

describe('AlertDialogHeader', () => {
  it('renders children', () => {
    render(<AlertDialogHeader>Header content</AlertDialogHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('merges extra className', () => {
    render(<AlertDialogHeader className="my-header">H</AlertDialogHeader>)
    expect(screen.getByText('H').className).toContain('my-header')
  })
})

describe('AlertDialogFooter', () => {
  it('renders children', () => {
    render(<AlertDialogFooter>Footer content</AlertDialogFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('merges extra className', () => {
    render(<AlertDialogFooter className="my-footer">F</AlertDialogFooter>)
    expect(screen.getByText('F').className).toContain('my-footer')
  })
})

// ---------------------------------------------------------------------------
// Full dialog (open state controlled)
// ---------------------------------------------------------------------------

describe('AlertDialog (controlled open)', () => {
  it('does not render content when closed', () => {
    // open=false — Radix does not mount the portal content, so no warning fires
    render(
      <AlertDialog open={false}>
        <AlertDialogContent>
          <AlertDialogTitle>Hidden Title</AlertDialogTitle>
          <AlertDialogDescription>Hidden description.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument()
  })

  it('renders content in a portal when open=true', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    // Radix renders into document.body portal — screen queries the whole document
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('renders title with correct heading semantics', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This action is permanent.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument()
  })

  it('renders AlertDialogAction as a button', () => {
    const handleAction = vi.fn()
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog</AlertDialogTitle>
          <AlertDialogDescription>Confirm the action below.</AlertDialogDescription>
          <AlertDialogAction onClick={handleAction}>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    )
    const actionBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(actionBtn).toBeInTheDocument()
    fireEvent.click(actionBtn)
    expect(handleAction).toHaveBeenCalledOnce()
  })

  it('renders AlertDialogCancel as a button', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog</AlertDialogTitle>
          <AlertDialogDescription>Choose an option below.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('applies buttonVariants classes to AlertDialogAction', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog</AlertDialogTitle>
          <AlertDialogDescription>Choose an option below.</AlertDialogDescription>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    )
    // buttonVariants default produces inline-flex
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('inline-flex')
  })

  it('applies outline buttonVariants classes to AlertDialogCancel', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog</AlertDialogTitle>
          <AlertDialogDescription>Choose an option below.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('border')
  })

  it('merges extra className on AlertDialogContent', () => {
    render(
      <AlertDialog open={true}>
        <AlertDialogContent className="my-content-class">
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    // The content container rendered in the portal should have the extra class
    const title = screen.getByText('Title')
    // Traverse to the content element (parent of header containing title)
    let el: HTMLElement | null = title
    let found = false
    while (el) {
      if (el.className?.includes('my-content-class')) {
        found = true
        break
      }
      el = el.parentElement
    }
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Trigger (uncontrolled open)
// ---------------------------------------------------------------------------

describe('AlertDialog (trigger interaction)', () => {
  it('opens when trigger is clicked', () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open Dialog</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Dialog Content</AlertDialogTitle>
          <AlertDialogDescription>Confirm or cancel the action.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    expect(screen.queryByText('Dialog Content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Open Dialog'))
    expect(screen.getByText('Dialog Content')).toBeInTheDocument()
  })

  it('calls onOpenChange when trigger is clicked', () => {
    const onOpenChange = vi.fn()
    render(
      <AlertDialog onOpenChange={onOpenChange}>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

/**
 * Tests for the shadcn/ui DropdownMenu React components
 * (`src/components/ui/dropdown-menu.tsx`).
 *
 * Uses the controlled `open` prop so content is visible without simulating
 * pointer events. Content is rendered into a Radix portal in document.body.
 * ResizeObserver and DOMRect polyfills are provided in component-setup.ts.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../../src/components/ui/dropdown-menu'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a standard DropdownMenu in controlled-open state so content is
 * immediately visible without pointer-event interaction.
 *
 * @param content - React nodes to place inside DropdownMenuContent.
 */
function renderOpenMenu(content: React.ReactNode) {
  return render(
    <DropdownMenu open={true}>
      <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
      <DropdownMenuContent>{content}</DropdownMenuContent>
    </DropdownMenu>,
  )
}

// ---------------------------------------------------------------------------
// DropdownMenuLabel
// ---------------------------------------------------------------------------

describe('DropdownMenuLabel', () => {
  it('renders label text', () => {
    renderOpenMenu(<DropdownMenuLabel>My Account</DropdownMenuLabel>)
    expect(screen.getByText('My Account')).toBeInTheDocument()
  })

  it('merges extra className', () => {
    renderOpenMenu(<DropdownMenuLabel className="label-extra">Label</DropdownMenuLabel>)
    expect(screen.getByText('Label').className).toContain('label-extra')
  })

  it('renders with inset prop', () => {
    renderOpenMenu(<DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>)
    expect(screen.getByText('Inset Label').className).toContain('pl-8')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuSeparator
// ---------------------------------------------------------------------------

describe('DropdownMenuSeparator', () => {
  it('renders a separator element', () => {
    renderOpenMenu(<DropdownMenuSeparator />)
    // Radix renders the separator with role="separator" or as a styled div
    const sep =
      document.querySelector('[data-orientation="horizontal"]') ??
      document.querySelector('.bg-muted')
    expect(sep).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuShortcut
// ---------------------------------------------------------------------------

describe('DropdownMenuShortcut', () => {
  it('renders shortcut text', () => {
    renderOpenMenu(
      <DropdownMenuItem>
        Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>,
    )
    expect(screen.getByText('⌘S')).toBeInTheDocument()
  })

  it('applies tracking-widest class', () => {
    renderOpenMenu(
      <DropdownMenuItem>
        Item <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
      </DropdownMenuItem>,
    )
    expect(screen.getByText('⌘X').className).toContain('tracking-widest')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuItem
// ---------------------------------------------------------------------------

describe('DropdownMenuItem', () => {
  it('renders item text', () => {
    renderOpenMenu(<DropdownMenuItem>Dashboard</DropdownMenuItem>)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders with inset prop', () => {
    renderOpenMenu(<DropdownMenuItem inset>Inset Item</DropdownMenuItem>)
    expect(screen.getByText('Inset Item').className).toContain('pl-8')
  })

  it('applies disabled styling when disabled', () => {
    renderOpenMenu(<DropdownMenuItem disabled>Disabled Item</DropdownMenuItem>)
    const item = screen.getByText('Disabled Item')
    expect(item.className).toContain('opacity-50')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuContent
// ---------------------------------------------------------------------------

describe('DropdownMenuContent', () => {
  it('renders multiple items', () => {
    renderOpenMenu(
      <>
        <DropdownMenuItem>Item One</DropdownMenuItem>
        <DropdownMenuItem>Item Two</DropdownMenuItem>
        <DropdownMenuItem>Item Three</DropdownMenuItem>
      </>,
    )
    expect(screen.getByText('Item One')).toBeInTheDocument()
    expect(screen.getByText('Item Two')).toBeInTheDocument()
    expect(screen.getByText('Item Three')).toBeInTheDocument()
  })

  it('renders with merged className', () => {
    render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-menu-class">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    // Walk up from the item to find the content container with the custom class
    const item = screen.getByText('Item')
    let el: HTMLElement | null = item
    let found = false
    while (el) {
      if (el.className?.includes('custom-menu-class')) {
        found = true
        break
      }
      el = el.parentElement
    }
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuCheckboxItem
// ---------------------------------------------------------------------------

describe('DropdownMenuCheckboxItem', () => {
  it('renders checkbox item text', () => {
    renderOpenMenu(
      <DropdownMenuCheckboxItem checked={false}>Show Toolbar</DropdownMenuCheckboxItem>,
    )
    expect(screen.getByText('Show Toolbar')).toBeInTheDocument()
  })

  it('renders with checked state', () => {
    renderOpenMenu(
      <DropdownMenuCheckboxItem checked={true}>Checked Option</DropdownMenuCheckboxItem>,
    )
    expect(screen.getByText('Checked Option')).toBeInTheDocument()
  })

  it('merges extra className', () => {
    renderOpenMenu(
      <DropdownMenuCheckboxItem checked={false} className="cb-extra">
        Option
      </DropdownMenuCheckboxItem>,
    )
    expect(screen.getByText('Option').closest('[class]')?.className).toContain('cb-extra')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuRadioGroup + DropdownMenuRadioItem
// ---------------------------------------------------------------------------

describe('DropdownMenuRadioItem', () => {
  it('renders radio item text', () => {
    renderOpenMenu(
      <DropdownMenuRadioGroup value="a">
        <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>,
    )
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('merges extra className on radio item', () => {
    renderOpenMenu(
      <DropdownMenuRadioGroup value="x">
        <DropdownMenuRadioItem value="x" className="radio-extra">
          Radio X
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>,
    )
    expect(screen.getByText('Radio X').closest('[class]')?.className).toContain('radio-extra')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenuSub + DropdownMenuSubTrigger + DropdownMenuSubContent
// ---------------------------------------------------------------------------

describe('DropdownMenuSubTrigger', () => {
  it('renders sub-trigger text in an open parent menu', () => {
    render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByText('More Options')).toBeInTheDocument()
  })

  it('renders with inset class on sub-trigger', () => {
    render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger>T</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>Inset Sub</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>X</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    const trigger = screen.getByText('Inset Sub')
    expect(trigger.className).toContain('pl-8')
  })
})

// ---------------------------------------------------------------------------
// DropdownMenu closed state
// ---------------------------------------------------------------------------

describe('DropdownMenu (closed)', () => {
  it('does not render content when closed', () => {
    render(
      <DropdownMenu open={false}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Hidden Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.queryByText('Hidden Item')).not.toBeInTheDocument()
  })

  it('renders the trigger element', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>My Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByText('My Trigger')).toBeInTheDocument()
  })
})

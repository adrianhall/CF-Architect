/**
 * Tests for the UserMenu React island (`src/components/ui/UserMenu.tsx`).
 *
 * The `dropdown-menu` module is mocked to render all menu content inline
 * (no portal, no pointer-event interaction required), allowing straightforward
 * assertions on which links are rendered and what they contain.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dropdown-menu — renders all children inline, menu always "open"
// ---------------------------------------------------------------------------

vi.mock('../../../src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dropdown-item">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}))

// ---------------------------------------------------------------------------
// Import under test (AFTER mocks are declared)
// ---------------------------------------------------------------------------

import { UserMenu } from '../../../src/components/ui/UserMenu'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// Default props helper
// ---------------------------------------------------------------------------

const defaultProps = {
  userName: 'Ada Lovelace',
  avatarUrl: null as string | null,
  isAdmin: false,
}

// ---------------------------------------------------------------------------
// Trigger / avatar rendering
// ---------------------------------------------------------------------------

describe('UserMenu — trigger rendering', () => {
  it('renders the user name in the trigger', () => {
    render(<UserMenu {...defaultProps} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('renders an <img> when avatarUrl is provided', () => {
    render(<UserMenu {...defaultProps} avatarUrl="https://example.com/avatar.png" />)
    const img = screen.getByRole('img', { name: 'Ada Lovelace' })
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.png')
  })

  it('renders initials when avatarUrl is null', () => {
    render(<UserMenu {...defaultProps} avatarUrl={null} />)
    // Initials of "Ada Lovelace" → "AL"
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('renders initials when avatarUrl is undefined', () => {
    render(<UserMenu userName="Bob" avatarUrl={null} isAdmin={false} />)
    // Single word name → "B"
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('derives initials from first two words only', () => {
    render(<UserMenu userName="John Michael Doe" avatarUrl={null} isAdmin={false} />)
    // "John Michael Doe" → first two words → "JM"
    expect(screen.getByText('JM')).toBeInTheDocument()
  })

  it('renders initials in uppercase', () => {
    render(<UserMenu userName="alice bob" avatarUrl={null} isAdmin={false} />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('renders the trigger button with an accessible aria-label', () => {
    render(<UserMenu {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Open user menu' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

describe('UserMenu — menu items', () => {
  it('renders a Dashboard link pointing to /dashboard', () => {
    render(<UserMenu {...defaultProps} />)
    const link = screen.getByRole('link', { name: /Dashboard/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('renders a New Diagram link pointing to /canvas/new', () => {
    render(<UserMenu {...defaultProps} />)
    const link = screen.getByRole('link', { name: /New Diagram/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/canvas/new')
  })

  it('renders a Sign Out link pointing to the CF Access logout URL', () => {
    render(<UserMenu {...defaultProps} />)
    const link = screen.getByRole('link', { name: /Sign Out/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/cdn-cgi/access/logout')
  })

  it('renders a separator between nav items and Sign Out', () => {
    render(<UserMenu {...defaultProps} />)
    expect(screen.getByTestId('dropdown-separator')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Admin visibility
// ---------------------------------------------------------------------------

describe('UserMenu — admin panel link', () => {
  it('shows the Admin Panel link when isAdmin is true', () => {
    render(<UserMenu {...defaultProps} isAdmin={true} />)
    const link = screen.getByRole('link', { name: /Admin Panel/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/admin')
  })

  it('hides the Admin Panel link when isAdmin is false', () => {
    render(<UserMenu {...defaultProps} isAdmin={false} />)
    expect(screen.queryByRole('link', { name: /Admin Panel/i })).not.toBeInTheDocument()
  })

  it('renders exactly 3 links for a non-admin user', () => {
    render(<UserMenu {...defaultProps} isAdmin={false} />)
    // Dashboard, New Diagram, Sign Out
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('renders exactly 4 links for an admin user', () => {
    render(<UserMenu {...defaultProps} isAdmin={true} />)
    // Dashboard, New Diagram, Admin Panel, Sign Out
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })
})

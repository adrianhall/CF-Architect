/**
 * Tests for the shadcn/ui Button React component (`src/components/ui/button.tsx`).
 *
 * Verifies variant class application, size class application, asChild rendering,
 * ref forwarding, and the `buttonVariants` CVA utility function directly.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button, buttonVariants } from '../../../src/components/ui/button'

afterEach(() => cleanup())

// ---------------------------------------------------------------------------
// buttonVariants (CVA helper)
// ---------------------------------------------------------------------------

describe('buttonVariants', () => {
  it('returns a non-empty class string', () => {
    const cls = buttonVariants()
    expect(typeof cls).toBe('string')
    expect(cls.length).toBeGreaterThan(0)
  })

  it('always includes the base inline-flex class', () => {
    expect(buttonVariants()).toContain('inline-flex')
  })

  it('produces distinct classes for different variants', () => {
    const defaultCls = buttonVariants({ variant: 'default' })
    const destructiveCls = buttonVariants({ variant: 'destructive' })
    const outlineCls = buttonVariants({ variant: 'outline' })
    const secondaryCls = buttonVariants({ variant: 'secondary' })
    const ghostCls = buttonVariants({ variant: 'ghost' })
    const linkCls = buttonVariants({ variant: 'link' })

    // Each variant produces a unique class set
    const all = [defaultCls, destructiveCls, outlineCls, secondaryCls, ghostCls, linkCls]
    const uniqueSets = new Set(all)
    expect(uniqueSets.size).toBe(6)
  })

  it('includes destructive-specific class for destructive variant', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive')
  })

  it('includes border class for outline variant', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border')
  })

  it('includes underline class for link variant', () => {
    expect(buttonVariants({ variant: 'link' })).toContain('underline-offset-4')
  })

  it('produces distinct classes for different sizes', () => {
    const defaultSz = buttonVariants({ size: 'default' })
    const smSz = buttonVariants({ size: 'sm' })
    const lgSz = buttonVariants({ size: 'lg' })
    const iconSz = buttonVariants({ size: 'icon' })

    expect(smSz).toContain('h-9')
    expect(lgSz).toContain('h-11')
    expect(iconSz).toContain('h-10')
    expect(iconSz).toContain('w-10')

    const all = [defaultSz, smSz, lgSz, iconSz]
    const uniqueSets = new Set(all)
    expect(uniqueSets.size).toBe(4)
  })

  it('accepts extra className via options', () => {
    const cls = buttonVariants({ className: 'my-extra-class' })
    expect(cls).toContain('my-extra-class')
  })
})

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------

describe('Button', () => {
  it('renders a <button> element by default', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole('button', { name: 'Click me' })
    expect(btn.tagName).toBe('BUTTON')
  })

  it('renders children correctly', () => {
    render(<Button>Submit</Button>)
    expect(screen.getByText('Submit')).toBeInTheDocument()
  })

  it('applies default variant classes', () => {
    render(<Button>Default</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-primary')
    expect(btn.className).toContain('inline-flex')
  })

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button').className).toContain('bg-destructive')
  })

  it('applies outline variant classes', () => {
    render(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button').className).toContain('border')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button').className).toContain('bg-secondary')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    // Ghost has hover classes but no solid bg — verify inline-flex still present
    expect(screen.getByRole('button').className).toContain('inline-flex')
  })

  it('applies link variant classes', () => {
    render(<Button variant="link">Link</Button>)
    expect(screen.getByRole('button').className).toContain('underline-offset-4')
  })

  it('applies sm size classes', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button').className).toContain('h-9')
  })

  it('applies lg size classes', () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button').className).toContain('h-11')
  })

  it('applies icon size classes', () => {
    render(
      <Button size="icon" aria-label="icon">
        ★
      </Button>,
    )
    expect(screen.getByRole('button').className).toContain('h-10')
    expect(screen.getByRole('button').className).toContain('w-10')
  })

  it('merges additional className prop', () => {
    render(<Button className="extra-class">Styled</Button>)
    expect(screen.getByRole('button').className).toContain('extra-class')
  })

  it('renders as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/path">Link Button</a>
      </Button>,
    )
    // Should render as an <a> tag, not a <button>
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link.tagName).toBe('A')
    expect(link.className).toContain('inline-flex')
  })

  it('renders a disabled button when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('has the correct displayName', () => {
    expect(Button.displayName).toBe('Button')
  })

  it('forwards ref to the underlying button element', () => {
    let capturedRef: HTMLButtonElement | null = null
    render(
      <Button
        ref={(el) => {
          capturedRef = el
        }}
      >
        Ref Button
      </Button>,
    )
    expect(capturedRef).not.toBeNull()
    expect(capturedRef!.tagName).toBe('BUTTON')
  })
})

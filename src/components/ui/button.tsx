/**
 * shadcn/ui Button React component.
 *
 * Thin wrapper around a native `<button>` (or any element via `asChild`) with
 * class-variance-authority variant management. Styled with Tailwind v4 utility
 * classes mapped to the project's design tokens in `src/styles/global.css`.
 *
 * Scaffolded via `npx shadcn@latest add button` and owned by this project.
 * Ref: https://ui.shadcn.com/docs/components/button
 */

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

/**
 * CVA variant function that produces the Tailwind class string for a Button.
 *
 * Available variants: `default` (CF orange primary), `destructive`, `outline`,
 * `secondary`, `ghost`, `link`.
 * Available sizes: `default`, `sm`, `lg`, `icon`.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

/**
 * Props for the {@link Button} component.
 * Extends all native `<button>` HTML attributes plus CVA variant props.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /**
   * When `true`, renders the child element directly using Radix UI's `Slot`,
   * merging the button's className and event handlers onto the child.
   * Useful for rendering `<a>` elements styled as buttons.
   */
  asChild?: boolean
}

/**
 * Versatile button component with support for multiple visual variants and
 * sizes. Renders as a native `<button>` by default; pass `asChild` to render
 * the child element (e.g. `<a>`) with button styling applied.
 *
 * @param props - {@link ButtonProps} including variant, size, and asChild.
 * @param ref - Forwarded ref to the underlying button (or child) element.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }

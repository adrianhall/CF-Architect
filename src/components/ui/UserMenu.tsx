/**
 * UserMenu — a React island that renders the authenticated user's avatar and
 * name as a dropdown menu trigger. Uses shadcn/ui DropdownMenu (Radix UI).
 *
 * Hydrated with `client:load` in dashboard and blueprint pages.
 * Ref: https://ui.shadcn.com/docs/components/dropdown-menu
 */

import { LayoutDashboard, LogOut, Plus, ShieldCheck } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

/**
 * Props for the UserMenu component.
 */
export interface UserMenuProps {
  /** The user's display name shown in the trigger and menu. */
  userName: string
  /** GitHub avatar URL, or `null` to display an initials fallback. */
  avatarUrl: string | null
  /** When `true`, an "Admin Panel" link is shown in the menu. */
  isAdmin: boolean
}

/**
 * Derive up to 2 initials from a display name for the avatar fallback.
 *
 * @param name - Full display name.
 * @returns Uppercase initials (1–2 characters).
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

/**
 * Dropdown user menu shown in the dashboard and blueprint page headers.
 * Provides navigation to Dashboard, New Diagram, Admin Panel (if admin),
 * and a Sign Out link to the CF Access logout endpoint.
 */
export function UserMenu({ userName, avatarUrl, isAdmin }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="text-cf-gray-900 hover:bg-cf-gray-50 focus-visible:ring-cf-orange/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Open user menu"
        >
          {/* Avatar */}
          <span className="bg-cf-orange flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              getInitials(userName)
            )}
          </span>
          <span className="hidden max-w-[140px] truncate sm:block">{userName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {/* Navigation items */}
        <DropdownMenuItem asChild>
          <a href="/dashboard" className="flex cursor-pointer items-center gap-2">
            <LayoutDashboard className="text-cf-gray-500 h-4 w-4" />
            Dashboard
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="/canvas/new" className="flex cursor-pointer items-center gap-2">
            <Plus className="text-cf-gray-500 h-4 w-4" />
            New Diagram
          </a>
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem asChild>
            <a href="/admin" className="flex cursor-pointer items-center gap-2">
              <ShieldCheck className="text-cf-gray-500 h-4 w-4" />
              Admin Panel
            </a>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Sign out — links to CF Access logout URL */}
        <DropdownMenuItem asChild>
          <a
            href="/cdn-cgi/access/logout"
            className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

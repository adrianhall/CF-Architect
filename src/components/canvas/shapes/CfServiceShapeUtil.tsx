/**
 * Custom tldraw shape for Cloudflare Developer Platform services (spec §4.3).
 *
 * A single `cf-service` shape type handles all Cloudflare services via
 * the `serviceType` prop, which keys into the service registry to look
 * up the display name and icon.
 *
 * Ref: https://tldraw.dev/docs/shapes
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
  T,
  resizeBox,
} from 'tldraw'

import { getServiceByType } from './cf-services'

// ---------------------------------------------------------------------------
// Type registration — tldraw v4 module augmentation pattern
// Ref: https://tldraw.dev/docs/shapes#Defining-the-shape-type
// ---------------------------------------------------------------------------

/** Shape type identifier for Cloudflare service shapes. */
const CF_SERVICE_TYPE = 'cf-service' as const

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [CF_SERVICE_TYPE]: CfServiceShapeProps
  }
}

/** Props stored on each cf-service shape instance. */
interface CfServiceShapeProps {
  /** Width in canvas units. */
  w: number
  /** Height in canvas units. */
  h: number
  /** Key into the service registry (e.g., `'workers'`, `'d1'`). */
  serviceType: string
  /** User-editable label displayed on the shape. */
  label: string
}

/** The tldraw shape type for Cloudflare service shapes. */
export type CfServiceShape = TLShape<typeof CF_SERVICE_TYPE>

// ---------------------------------------------------------------------------
// Cloudflare brand constants
// ---------------------------------------------------------------------------

/** Cloudflare orange accent colour. */
const CF_ORANGE = '#F6821F'
/** Cloudflare dark background colour. */
const CF_DARK = '#1A1A2E'

// ---------------------------------------------------------------------------
// ShapeUtil
// ---------------------------------------------------------------------------

/**
 * tldraw ShapeUtil for the `cf-service` custom shape.
 *
 * Extends {@link BaseBoxShapeUtil} for built-in resize handles and
 * rectangular geometry. Renders each Cloudflare service with its icon,
 * display name, and a user-editable label.
 */
export class CfServiceShapeUtil extends BaseBoxShapeUtil<CfServiceShape> {
  static override type = CF_SERVICE_TYPE

  /** Prop validators using tldraw's T runtime validators. */
  static override props: RecordProps<CfServiceShape> = {
    w: T.number,
    h: T.number,
    serviceType: T.string,
    label: T.string,
  }

  /** Default props for newly created cf-service shapes. */
  override getDefaultProps(): CfServiceShape['props'] {
    return {
      w: 140,
      h: 140,
      serviceType: 'workers',
      label: 'Workers',
    }
  }

  /** Allow the user to resize the shape. */
  override canResize(): boolean {
    return true
  }

  /** Allow double-click to edit the label. */
  override canEdit(): boolean {
    return true
  }

  /** Handle resize via the standard box resize utility. */
  override onResize(shape: CfServiceShape, info: TLResizeInfo<CfServiceShape>) {
    return resizeBox(shape, info)
  }

  /**
   * Render the shape as a React component.
   *
   * Layout:
   * - Orange accent header strip
   * - Centred service icon
   * - Service display name
   * - User-editable label (dimmer text)
   */
  override component(shape: CfServiceShape) {
    const service = getServiceByType(shape.props.serviceType)
    const displayName = service?.displayName ?? shape.props.serviceType
    const iconPath = service?.iconPath ?? '/icons/cf/workers.svg'

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: CF_DARK,
          borderRadius: '8px',
          border: `2px solid ${CF_ORANGE}`,
          overflow: 'hidden',
          pointerEvents: 'all',
        }}
      >
        {/* Orange accent header strip */}
        <div
          style={{
            width: '100%',
            height: '4px',
            backgroundColor: CF_ORANGE,
            flexShrink: 0,
          }}
        />

        {/* Icon container */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            minHeight: 0,
          }}
        >
          <img
            src={iconPath}
            alt={displayName}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
            }}
            draggable={false}
          />
        </div>

        {/* Service name */}
        <div
          style={{
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.2,
            paddingLeft: '4px',
            paddingRight: '4px',
          }}
        >
          {displayName}
        </div>

        {/* User label */}
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '10px',
            textAlign: 'center',
            paddingBottom: '8px',
            paddingLeft: '4px',
            paddingRight: '4px',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {shape.props.label}
        </div>
      </HTMLContainer>
    )
  }

  /** Render the selection indicator (standard box outline). */
  override indicator(shape: CfServiceShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
  }

  /**
   * Render a clean native SVG for export.
   *
   * Uses `<rect>`, `<text>`, and `<image>` — no `<foreignObject>`.
   */
  override toSvg(shape: CfServiceShape) {
    const { w, h, serviceType, label } = shape.props
    const service = getServiceByType(serviceType)
    const displayName = service?.displayName ?? serviceType
    const iconPath = service?.iconPath ?? '/icons/cf/workers.svg'

    return (
      <g>
        {/* Background */}
        <rect
          width={w}
          height={h}
          rx={8}
          ry={8}
          fill={CF_DARK}
          stroke={CF_ORANGE}
          strokeWidth={2}
        />
        {/* Orange accent strip */}
        <rect width={w} height={4} rx={0} ry={0} fill={CF_ORANGE} />
        {/* Icon */}
        <image href={iconPath} x={w / 2 - 24} y={h / 2 - 36} width={48} height={48} />
        {/* Service name */}
        <text
          x={w / 2}
          y={h - 28}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={12}
          fontWeight={600}
        >
          {displayName}
        </text>
        {/* Label */}
        <text x={w / 2} y={h - 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>
          {label}
        </text>
      </g>
    )
  }
}

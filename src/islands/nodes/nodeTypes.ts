import { CFNode } from "./CFNode";

/**
 * React Flow nodeTypes registry mapping the "cf-node" type key to the CFNode
 * component. All 30 product types use this single component.
 */
export const nodeTypes = {
  "cf-node": CFNode,
};

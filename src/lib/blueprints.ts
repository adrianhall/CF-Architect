export interface Blueprint {
  id: string;
  title: string;
  description: string;
  category: string;
  graphData: string;
}

export const BLUEPRINTS: Blueprint[] = [];

export const BLUEPRINT_MAP = new Map(BLUEPRINTS.map((b) => [b.id, b]));

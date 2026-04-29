import { NodeKind, VisualTemplate } from '../types.js';

/**
 * Modèles visuels par défaut. Chaque type de composant DSL a son apparence.
 * Ces valeurs peuvent être surchargées par un mapping vers un stencil custom.
 */
export const BUILTIN_TEMPLATES: Record<NodeKind, VisualTemplate> = {
  component: {
    kind: 'component',
    defaultWidth: 160,
    defaultHeight: 80,
    fillColor: '#4A90E2',
    strokeColor: '#2E5C8A',
    textColor: '#FFFFFF',
    shape: 'roundedRect',
  },
  service: {
    kind: 'service',
    defaultWidth: 160,
    defaultHeight: 80,
    fillColor: '#7ED321',
    strokeColor: '#5B9E18',
    textColor: '#FFFFFF',
    shape: 'roundedRect',
  },
  database: {
    kind: 'database',
    defaultWidth: 130,
    defaultHeight: 100,
    fillColor: '#F5A623',
    strokeColor: '#B8771A',
    textColor: '#FFFFFF',
    shape: 'cylinder',
  },
  queue: {
    kind: 'queue',
    defaultWidth: 160,
    defaultHeight: 60,
    fillColor: '#BD10E0',
    strokeColor: '#820A9C',
    textColor: '#FFFFFF',
    shape: 'parallelogram',
  },
  external: {
    kind: 'external',
    defaultWidth: 150,
    defaultHeight: 80,
    fillColor: '#9B9B9B',
    strokeColor: '#606060',
    textColor: '#FFFFFF',
    shape: 'rectangle',
  },
  actor: {
    kind: 'actor',
    defaultWidth: 80,
    defaultHeight: 100,
    fillColor: '#FFFFFF',
    strokeColor: '#333333',
    textColor: '#333333',
    shape: 'ellipse',
  },
  group: {
    kind: 'group',
    defaultWidth: 400,
    defaultHeight: 300,
    fillColor: '#F0F0F0',
    strokeColor: '#999999',
    textColor: '#333333',
    shape: 'rectangle',
  },
};

/**
 * Mapping optionnel vers un stencil utilisateur. Si une entrée existe pour
 * un kind, on utilise le Master Shape du stencil au lieu du modèle built-in.
 */
export interface StencilMapping {
  [kind: string]: { stencilName: string; masterId: string };
}

export function getTemplate(
  kind: NodeKind,
  stencilMapping?: StencilMapping,
): VisualTemplate {
  const base = BUILTIN_TEMPLATES[kind];
  if (stencilMapping?.[kind]) {
    return { ...base, masterShapeRef: stencilMapping[kind] };
  }
  return base;
}

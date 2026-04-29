/**
 * Modèle de données central : ce que produit le parser et que consomment
 * le moteur de layout puis le générateur .vsdx.
 */

export type NodeKind =
  | 'component'
  | 'service'
  | 'database'
  | 'queue'
  | 'external'
  | 'actor'
  | 'group';

export type EdgeStyle = 'solid' | 'dashed';

export interface DiagramNode {
  id: string;              // identifiant DSL (ex: "auth")
  kind: NodeKind;          // type → détermine le modèle visuel
  label: string;           // texte affiché
  tech?: string;           // techno (ex: "PostgreSQL")
  description?: string;
  parentId?: string;       // id du group parent, si imbriqué
  // Position et taille — remplies par le moteur de layout
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  style: EdgeStyle;
  // Points de routage — remplis par le moteur de layout
  bendpoints?: Array<{ x: number; y: number }>;
}

export interface Diagram {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/**
 * Définition d'un modèle visuel : à quoi ressemble une boîte de type X.
 * Toutes les unités sont en pouces (Visio interne) — on convertit en sortie.
 */
export interface VisualTemplate {
  kind: NodeKind;
  defaultWidth: number;     // en pixels logiques (layout)
  defaultHeight: number;
  fillColor: string;        // hex, ex: "#4A90E2"
  strokeColor: string;
  textColor: string;
  shape: 'rectangle' | 'roundedRect' | 'cylinder' | 'parallelogram' | 'ellipse';
  // Si on utilise un Master Shape d'un stencil custom
  masterShapeRef?: {
    stencilName: string;
    masterId: string;
  };
}

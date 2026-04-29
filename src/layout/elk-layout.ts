import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs';
import { Diagram, DiagramNode } from '../types.js';
import { BUILTIN_TEMPLATES } from '../generator/templates.js';

/**
 * Applique un layout automatique au diagramme via ELK.
 * Modifie en place les noeuds (x, y, width, height) et les edges (bendpoints).
 *
 * Algorithme : "layered" (Sugiyama) → idéal pour des diagrammes orientés
 * comme une architecture de composants avec un sens de flux logique.
 */
export async function applyLayout(diagram: Diagram): Promise<void> {
  const elk = new ELK();

  // Construction du graphe ELK avec hiérarchie (groups)
  const nodesById = new Map(diagram.nodes.map((n) => [n.id, n]));

  // On retrouve les enfants directs d'un noeud (ou de la racine)
  const childrenOf = (parentId: string | undefined): DiagramNode[] =>
    diagram.nodes.filter((n) => n.parentId === parentId);

  function buildElkNode(node: DiagramNode): ElkNode {
    const tpl = BUILTIN_TEMPLATES[node.kind];
    const elkNode: ElkNode = {
      id: node.id,
      width: tpl.defaultWidth,
      height: tpl.defaultHeight,
    };
    const children = childrenOf(node.id);
    if (children.length > 0) {
      elkNode.children = children.map(buildElkNode);
      // Pour les groups, on laisse ELK calculer la taille
      delete elkNode.width;
      delete elkNode.height;
      elkNode.layoutOptions = {
        'elk.padding': '[top=40,left=20,bottom=20,right=20]',
      };
    }
    return elkNode;
  }

  const rootChildren = childrenOf(undefined).map(buildElkNode);

  // Les edges référencent toujours les feuilles, pas les groups
  const elkEdges: ElkExtendedEdge[] = diagram.edges.map((e) => ({
    id: e.id,
    sources: [e.sourceId],
    targets: [e.targetId],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: rootChildren,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  // Application des positions calculées
  // ELK donne des positions relatives au parent — on les convertit en absolues
  function applyPositions(elkNode: ElkNode, offsetX = 0, offsetY = 0): void {
    if (elkNode.id === 'root') {
      for (const child of elkNode.children ?? []) {
        applyPositions(child, 0, 0);
      }
      return;
    }
    const node = nodesById.get(elkNode.id);
    if (node) {
      node.x = (elkNode.x ?? 0) + offsetX;
      node.y = (elkNode.y ?? 0) + offsetY;
      node.width = elkNode.width;
      node.height = elkNode.height;
    }
    for (const child of elkNode.children ?? []) {
      applyPositions(
        child,
        (elkNode.x ?? 0) + offsetX,
        (elkNode.y ?? 0) + offsetY,
      );
    }
  }

  applyPositions(result);

  // Edges → bendpoints
  const edgesById = new Map(diagram.edges.map((e) => [e.id, e]));
  function collectEdges(elkNode: ElkNode): void {
    for (const e of elkNode.edges ?? []) {
      const edge = edgesById.get(e.id);
      if (edge && e.sections && e.sections[0]?.bendPoints) {
        edge.bendpoints = e.sections[0].bendPoints.map((p) => ({
          x: p.x,
          y: p.y,
        }));
      }
    }
    for (const child of elkNode.children ?? []) {
      collectEdges(child);
    }
  }
  collectEdges(result);
}

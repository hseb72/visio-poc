import { Diagram, DiagramNode, DiagramEdge, VisualTemplate } from '../types.js';
import { getTemplate, StencilMapping } from './templates.js';

/**
 * Génère le contenu d'une page Visio (page1.xml).
 *
 * Visio utilise les pouces comme unité interne. Le système de coordonnées
 * a son origine en bas à gauche (contrairement à SVG/écran). On convertit
 * depuis nos pixels logiques (origine top-left) ici.
 *
 * Conversion : 1 inch = 96 pixels logiques (DPI standard).
 * Page A3 paysage par défaut : 16.5 x 11.7 pouces.
 */

const PX_TO_INCH = 1 / 96;
const PAGE_HEIGHT_INCH = 11.7;

function px2inch(px: number): number {
  return Number((px * PX_TO_INCH).toFixed(4));
}

/**
 * Convertit (x, y, w, h) du système écran (origine top-left, en px)
 * vers le système Visio (origine bottom-left, en pouces).
 * Visio attribue (PinX, PinY) au centre de la forme.
 */
function toVisioCoords(
  x: number,
  y: number,
  w: number,
  h: number,
): { pinX: number; pinY: number; width: number; height: number } {
  const widthIn = px2inch(w);
  const heightIn = px2inch(h);
  const pinX = px2inch(x) + widthIn / 2;
  const pinY = PAGE_HEIGHT_INCH - (px2inch(y) + heightIn / 2);
  return { pinX, pinY, width: widthIn, height: heightIn };
}

/**
 * Échappe le texte pour XML.
 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convertit une couleur hex "#RRGGBB" au format Visio "#RRGGBB" (identique)
 * mais nécessite parfois le format RGB(r,g,b). Visio accepte les deux.
 */
function visioColor(hex: string): string {
  return hex.toUpperCase();
}

/**
 * Génère le fragment <Shape> pour un noeud.
 * On utilise une approche "shape primitive" : un rectangle/cylindre/etc.
 * dessiné via les Sections Geom de Visio.
 *
 * Pour rester simple dans ce POC, on génère des rectangles avec des styles
 * différents. Les formes plus complexes (cylindre, parallélogramme) seront
 * ajoutées en V2 — Visio les supporte via les Geom Sections en LineTo/MoveTo.
 */
function generateNodeShape(
  node: DiagramNode,
  shapeId: number,
  template: VisualTemplate,
): string {
  if (
    node.x === undefined ||
    node.y === undefined ||
    node.width === undefined ||
    node.height === undefined
  ) {
    throw new Error(`Node ${node.id} n'a pas de position calculée`);
  }

  const { pinX, pinY, width, height } = toVisioCoords(
    node.x,
    node.y,
    node.width,
    node.height,
  );

  const labelLines = [node.label];
  if (node.tech) labelLines.push(`[${node.tech}]`);
  const fullLabel = labelLines.join('\n');

  return `    <Shape ID="${shapeId}" NameU="${xmlEscape(node.id)}" Name="${xmlEscape(node.id)}" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3">
      <Cell N="PinX" V="${pinX}"/>
      <Cell N="PinY" V="${pinY}"/>
      <Cell N="Width" V="${width}"/>
      <Cell N="Height" V="${height}"/>
      <Cell N="LocPinX" V="${width / 2}" F="Width*0.5"/>
      <Cell N="LocPinY" V="${height / 2}" F="Height*0.5"/>
      <Cell N="FillForegnd" V="${visioColor(template.fillColor)}"/>
      <Cell N="LineColor" V="${visioColor(template.strokeColor)}"/>
      <Cell N="LineWeight" V="0.02"/>
      <Cell N="Char" V="0"><Cell N="Color" V="${visioColor(template.textColor)}"/></Cell>
      <Section N="Character">
        <Row IX="0">
          <Cell N="Color" V="${visioColor(template.textColor)}"/>
          <Cell N="Size" V="0.1388888888888889"/>
        </Row>
      </Section>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="0"/>
        <Cell N="NoLine" V="0"/>
        <Row T="RelMoveTo" IX="1">
          <Cell N="X" V="0"/>
          <Cell N="Y" V="0"/>
        </Row>
        <Row T="RelLineTo" IX="2">
          <Cell N="X" V="1"/>
          <Cell N="Y" V="0"/>
        </Row>
        <Row T="RelLineTo" IX="3">
          <Cell N="X" V="1"/>
          <Cell N="Y" V="1"/>
        </Row>
        <Row T="RelLineTo" IX="4">
          <Cell N="X" V="0"/>
          <Cell N="Y" V="1"/>
        </Row>
        <Row T="RelLineTo" IX="5">
          <Cell N="X" V="0"/>
          <Cell N="Y" V="0"/>
        </Row>
      </Section>
      <Text>${xmlEscape(fullLabel)}</Text>
    </Shape>`;
}

/**
 * Génère le fragment <Shape> pour un connecteur (edge).
 * Un connecteur Visio est une forme de type "Connector" avec deux endpoints
 * (BeginX/Y et EndX/Y) qui peuvent être liés aux shapes via des connections.
 */
function generateEdgeShape(
  edge: DiagramEdge,
  shapeId: number,
  nodeIdToShapeId: Map<string, number>,
  nodes: Map<string, DiagramNode>,
): string {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);
  if (!source || !target) {
    throw new Error(
      `Edge ${edge.id} référence un noeud inexistant : ${edge.sourceId} -> ${edge.targetId}`,
    );
  }

  // Centres en coords Visio
  const sCoords = toVisioCoords(
    source.x!,
    source.y!,
    source.width!,
    source.height!,
  );
  const tCoords = toVisioCoords(
    target.x!,
    target.y!,
    target.width!,
    target.height!,
  );

  const sourceShapeId = nodeIdToShapeId.get(edge.sourceId);
  const targetShapeId = nodeIdToShapeId.get(edge.targetId);

  const linePattern = edge.style === 'dashed' ? '2' : '1';
  const labelText = edge.label ? xmlEscape(edge.label) : '';

  return `    <Shape ID="${shapeId}" NameU="${xmlEscape(edge.id)}" Name="${xmlEscape(edge.id)}" Type="Shape" Master="0">
      <Cell N="PinX" V="${(sCoords.pinX + tCoords.pinX) / 2}"/>
      <Cell N="PinY" V="${(sCoords.pinY + tCoords.pinY) / 2}"/>
      <Cell N="Width" V="${Math.abs(tCoords.pinX - sCoords.pinX) || 0.01}"/>
      <Cell N="Height" V="${Math.abs(tCoords.pinY - sCoords.pinY) || 0.01}"/>
      <Cell N="BeginX" V="${sCoords.pinX}"/>
      <Cell N="BeginY" V="${sCoords.pinY}"/>
      <Cell N="EndX" V="${tCoords.pinX}"/>
      <Cell N="EndY" V="${tCoords.pinY}"/>
      <Cell N="ConFixedCode" V="6"/>
      <Cell N="LineColor" V="#333333"/>
      <Cell N="LineWeight" V="0.015"/>
      <Cell N="LinePattern" V="${linePattern}"/>
      <Cell N="EndArrow" V="4"/>
      <Cell N="ObjType" V="2"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="1"/>
        <Cell N="NoLine" V="0"/>
        <Row T="MoveTo" IX="1">
          <Cell N="X" V="${sCoords.pinX - (sCoords.pinX + tCoords.pinX) / 2 + Math.abs(tCoords.pinX - sCoords.pinX) / 2}" F="Width*0"/>
          <Cell N="Y" V="0" F="Height*0"/>
        </Row>
        <Row T="LineTo" IX="2">
          <Cell N="X" V="${Math.abs(tCoords.pinX - sCoords.pinX)}" F="Width*1"/>
          <Cell N="Y" V="${Math.abs(tCoords.pinY - sCoords.pinY)}" F="Height*1"/>
        </Row>
      </Section>
      <Text>${labelText}</Text>
    </Shape>`;
}

/**
 * Génère le XML complet d'une page contenant tous les noeuds et edges.
 */
export function generatePageXml(
  diagram: Diagram,
  stencilMapping?: StencilMapping,
): string {
  const nodesMap = new Map(diagram.nodes.map((n) => [n.id, n]));
  const nodeIdToShapeId = new Map<string, number>();

  // On commence à ID=1
  let shapeId = 1;
  const shapeFragments: string[] = [];

  // Trier : les groups d'abord (en arrière-plan), puis les autres noeuds
  const sortedNodes = [...diagram.nodes].sort((a, b) => {
    if (a.kind === 'group' && b.kind !== 'group') return -1;
    if (a.kind !== 'group' && b.kind === 'group') return 1;
    return 0;
  });

  for (const node of sortedNodes) {
    const template = getTemplate(node.kind, stencilMapping);
    nodeIdToShapeId.set(node.id, shapeId);
    shapeFragments.push(generateNodeShape(node, shapeId, template));
    shapeId++;
  }

  for (const edge of diagram.edges) {
    shapeFragments.push(
      generateEdgeShape(edge, shapeId, nodeIdToShapeId, nodesMap),
    );
    shapeId++;
  }

  return `<?xml version="1.0" encoding="utf-8" ?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <Shapes>
${shapeFragments.join('\n')}
  </Shapes>
</PageContents>`;
}

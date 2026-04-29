import { CstParser, CstNode, IToken } from 'chevrotain';
import * as T from './lexer.js';
import { Diagram, DiagramNode, DiagramEdge, NodeKind } from '../types.js';

/**
 * Grammaire du DSL :
 *
 *   diagramRule    := "diagram" StringLiteral "{" element* "}"
 *   element        := nodeDecl | groupDecl | edgeDecl
 *   nodeDecl       := nodeKind Identifier ("as" StringLiteral)? nodeBody?
 *   nodeKind       := "component" | "service" | "database" | "queue" | "external" | "actor"
 *   nodeBody       := "{" property* "}"
 *   property       := propertyKey ":" propertyValue
 *   groupDecl      := "group" Identifier ("as" StringLiteral)? "{" "contains" ":" idList "}"
 *   idList         := Identifier ("," Identifier)*
 *   edgeDecl       := Identifier arrow Identifier (":" StringLiteral)?
 *   arrow          := "->" | "..>"
 */
export class DslParser extends CstParser {
  constructor() {
    super(T.allTokens, { recoveryEnabled: true });
    this.performSelfAnalysis();
  }

  public diagramRule = this.RULE('diagramRule', () => {
    this.CONSUME(T.Diagram);
    this.CONSUME(T.StringLiteral);
    this.CONSUME(T.LCurly);
    this.MANY(() => {
      this.SUBRULE(this.element);
    });
    this.CONSUME(T.RCurly);
  });

  private element = this.RULE('element', () => {
    // Pour distinguer entre nodeDecl/groupDecl/edgeDecl, on regarde le 1er token
    // Si c'est un nodeKind ou "group" → déclaration
    // Si c'est un Identifier → c'est forcément un edge (Identifier -> Identifier)
    this.OR([
      { ALT: () => this.SUBRULE(this.nodeDecl) },
      { ALT: () => this.SUBRULE(this.groupDecl) },
      { ALT: () => this.SUBRULE(this.edgeDecl) },
    ]);
  });

  private nodeDecl = this.RULE('nodeDecl', () => {
    this.SUBRULE(this.nodeKind);
    this.CONSUME(T.Identifier);
    this.OPTION(() => {
      this.CONSUME(T.As);
      this.CONSUME(T.StringLiteral);
    });
    this.OPTION2(() => {
      this.SUBRULE(this.nodeBody);
    });
  });

  private nodeKind = this.RULE('nodeKind', () => {
    this.OR([
      { ALT: () => this.CONSUME(T.Component) },
      { ALT: () => this.CONSUME(T.Service) },
      { ALT: () => this.CONSUME(T.Database) },
      { ALT: () => this.CONSUME(T.Queue) },
      { ALT: () => this.CONSUME(T.External) },
      { ALT: () => this.CONSUME(T.Actor) },
    ]);
  });

  private nodeBody = this.RULE('nodeBody', () => {
    this.CONSUME(T.LCurly);
    this.MANY(() => {
      this.SUBRULE(this.property);
    });
    this.CONSUME(T.RCurly);
  });

  private property = this.RULE('property', () => {
    this.OR([
      { ALT: () => this.CONSUME(T.Tech) },
      { ALT: () => this.CONSUME(T.Description) },
    ]);
    this.CONSUME(T.Colon);
    this.CONSUME(T.StringLiteral);
  });

  private groupDecl = this.RULE('groupDecl', () => {
    this.CONSUME(T.Group);
    this.CONSUME(T.Identifier);
    this.OPTION(() => {
      this.CONSUME(T.As);
      this.CONSUME(T.StringLiteral);
    });
    this.CONSUME(T.LCurly);
    this.CONSUME(T.Contains);
    this.CONSUME(T.Colon);
    this.SUBRULE(this.idList);
    this.CONSUME(T.RCurly);
  });

  private idList = this.RULE('idList', () => {
    this.CONSUME(T.Identifier);
    this.MANY(() => {
      this.CONSUME(T.Comma);
      this.CONSUME2(T.Identifier);
    });
  });

  private edgeDecl = this.RULE('edgeDecl', () => {
    this.CONSUME(T.Identifier);
    this.OR([
      { ALT: () => this.CONSUME(T.SolidArrow) },
      { ALT: () => this.CONSUME(T.DashedArrow) },
    ]);
    this.CONSUME2(T.Identifier);
    this.OPTION(() => {
      this.CONSUME(T.Colon);
      this.CONSUME(T.StringLiteral);
    });
  });
}

const parserInstance = new DslParser();
const BaseVisitor = parserInstance.getBaseCstVisitorConstructor();

/**
 * Visitor qui convertit le CST (Concrete Syntax Tree) de Chevrotain
 * en notre modèle Diagram.
 */
class DslToAstVisitor extends BaseVisitor {
  private nodes: DiagramNode[] = [];
  private edges: DiagramEdge[] = [];
  private edgeCounter = 0;

  constructor() {
    super();
    this.validateVisitor();
  }

  reset() {
    this.nodes = [];
    this.edges = [];
    this.edgeCounter = 0;
  }

  diagramRule(ctx: any): Diagram {
    this.reset();
    const title = stripQuotes(ctx.StringLiteral[0].image);
    if (ctx.element) {
      for (const el of ctx.element) {
        this.visit(el);
      }
    }
    return { title, nodes: this.nodes, edges: this.edges };
  }

  element(ctx: any): void {
    if (ctx.nodeDecl) this.visit(ctx.nodeDecl);
    else if (ctx.groupDecl) this.visit(ctx.groupDecl);
    else if (ctx.edgeDecl) this.visit(ctx.edgeDecl);
  }

  nodeDecl(ctx: any): void {
    const kind = this.visit(ctx.nodeKind) as NodeKind;
    const id = ctx.Identifier[0].image;
    const label = ctx.StringLiteral
      ? stripQuotes(ctx.StringLiteral[0].image)
      : id;
    const props: { tech?: string; description?: string } = ctx.nodeBody
      ? this.visit(ctx.nodeBody)
      : {};
    this.nodes.push({ id, kind, label, ...props });
  }

  nodeKind(ctx: any): NodeKind {
    if (ctx.Component) return 'component';
    if (ctx.Service) return 'service';
    if (ctx.Database) return 'database';
    if (ctx.Queue) return 'queue';
    if (ctx.External) return 'external';
    if (ctx.Actor) return 'actor';
    throw new Error('nodeKind inconnu');
  }

  nodeBody(ctx: any): { tech?: string; description?: string } {
    const props: { tech?: string; description?: string } = {};
    if (ctx.property) {
      for (const p of ctx.property) {
        const visited = this.visit(p) as { key: string; value: string };
        if (visited.key === 'tech') props.tech = visited.value;
        else if (visited.key === 'description') props.description = visited.value;
      }
    }
    return props;
  }

  property(ctx: any): { key: string; value: string } {
    const value = stripQuotes(ctx.StringLiteral[0].image);
    if (ctx.Tech) return { key: 'tech', value };
    if (ctx.Description) return { key: 'description', value };
    return { key: '', value };
  }

  groupDecl(ctx: any): void {
    const id = ctx.Identifier[0].image;
    const label = ctx.StringLiteral
      ? stripQuotes(ctx.StringLiteral[0].image)
      : id;
    this.nodes.push({ id, kind: 'group', label });
    const childIds = this.visit(ctx.idList) as string[];
    // On marquera plus tard les enfants avec parentId
    for (const childId of childIds) {
      // On les retrouvera et on assignera parentId une fois tous les noeuds parsés
      this.pendingGroupAssignments.push({ childId, parentId: id });
    }
  }

  idList(ctx: any): string[] {
    return ctx.Identifier.map((t: IToken) => t.image);
  }

  edgeDecl(ctx: any): void {
    const sourceId = ctx.Identifier[0].image;
    const targetId = ctx.Identifier[1].image;
    const style = ctx.SolidArrow ? 'solid' : 'dashed';
    const label = ctx.StringLiteral
      ? stripQuotes(ctx.StringLiteral[0].image)
      : undefined;
    this.edges.push({
      id: `e${++this.edgeCounter}`,
      sourceId,
      targetId,
      style,
      label,
    });
  }

  // Pour gérer les assignations parent → enfant après coup
  private pendingGroupAssignments: Array<{
    childId: string;
    parentId: string;
  }> = [];

  finalizeGroups(): void {
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    for (const { childId, parentId } of this.pendingGroupAssignments) {
      const child = byId.get(childId);
      if (child) child.parentId = parentId;
    }
    this.pendingGroupAssignments = [];
  }
}

function stripQuotes(s: string): string {
  return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

const visitorInstance = new DslToAstVisitor();

export interface ParseResult {
  diagram?: Diagram;
  errors: Array<{ message: string; line?: number; column?: number }>;
}

/**
 * Parse une chaîne DSL et retourne soit le diagramme, soit les erreurs.
 */
export function parseDsl(input: string): ParseResult {
  const lexResult = T.dslLexer.tokenize(input);
  if (lexResult.errors.length > 0) {
    return {
      errors: lexResult.errors.map((e) => ({
        message: e.message,
        line: e.line,
        column: e.column,
      })),
    };
  }

  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.diagramRule();

  if (parserInstance.errors.length > 0) {
    return {
      errors: parserInstance.errors.map((e) => ({
        message: e.message,
        line: e.token.startLine,
        column: e.token.startColumn,
      })),
    };
  }

  visitorInstance.reset();
  const diagram = visitorInstance.visit(cst) as Diagram;
  visitorInstance.finalizeGroups();

  // Validation sémantique : tous les ids référencés par les edges existent
  const semanticErrors: Array<{ message: string }> = [];
  const ids = new Set(diagram.nodes.map((n) => n.id));
  for (const edge of diagram.edges) {
    if (!ids.has(edge.sourceId)) {
      semanticErrors.push({
        message: `Noeud source inconnu : ${edge.sourceId}`,
      });
    }
    if (!ids.has(edge.targetId)) {
      semanticErrors.push({
        message: `Noeud cible inconnu : ${edge.targetId}`,
      });
    }
  }

  if (semanticErrors.length > 0) {
    return { errors: semanticErrors, diagram };
  }

  return { diagram, errors: [] };
}

export { parserInstance };

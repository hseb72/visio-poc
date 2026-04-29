import { createToken, Lexer } from 'chevrotain';

/**
 * Tokens du DSL d'architecture logicielle.
 *
 * Exemple :
 *   diagram "Mon Archi" {
 *     component api as "API"
 *     api -> auth: "valide"
 *   }
 */

// Whitespace ignoré
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// Commentaires : // jusqu'à la fin de ligne
export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n\r]*/,
  group: Lexer.SKIPPED,
});

// Mots-clés de structure
export const Diagram = createToken({ name: 'Diagram', pattern: /diagram\b/ });
export const Group = createToken({ name: 'Group', pattern: /group\b/ });
export const As = createToken({ name: 'As', pattern: /as\b/ });

// Mots-clés "kind" de noeuds
export const Component = createToken({
  name: 'Component',
  pattern: /component\b/,
});
export const Service = createToken({ name: 'Service', pattern: /service\b/ });
export const Database = createToken({ name: 'Database', pattern: /database\b/ });
export const Queue = createToken({ name: 'Queue', pattern: /queue\b/ });
export const External = createToken({ name: 'External', pattern: /external\b/ });
export const Actor = createToken({ name: 'Actor', pattern: /actor\b/ });

// Propriétés (clés réservées)
export const Tech = createToken({ name: 'Tech', pattern: /tech\b/ });
export const Description = createToken({
  name: 'Description',
  pattern: /description\b/,
});
export const Contains = createToken({
  name: 'Contains',
  pattern: /contains\b/,
});

// Symboles
export const LCurly = createToken({ name: 'LCurly', pattern: /\{/ });
export const RCurly = createToken({ name: 'RCurly', pattern: /\}/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });

// Flèches : -> (solid) et ..> (dashed)
// Important : DashedArrow doit être défini AVANT SolidArrow pour la priorité
export const DashedArrow = createToken({
  name: 'DashedArrow',
  pattern: /\.\.>/,
});
export const SolidArrow = createToken({ name: 'SolidArrow', pattern: /->/ });

// Littéraux
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/,
});

// Identifiant : doit venir APRÈS les mots-clés (longest_alt principle)
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// Ordre : les mots-clés AVANT Identifier, sinon ils seraient capturés comme identifiants.
export const allTokens = [
  WhiteSpace,
  LineComment,
  // mots-clés
  Diagram,
  Group,
  As,
  Component,
  Service,
  Database,
  Queue,
  External,
  Actor,
  Tech,
  Description,
  Contains,
  // symboles
  LCurly,
  RCurly,
  Colon,
  Comma,
  DashedArrow,
  SolidArrow,
  // littéraux et identifiants (en dernier)
  StringLiteral,
  Identifier,
];

export const dslLexer = new Lexer(allTokens);

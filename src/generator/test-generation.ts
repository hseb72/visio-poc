import { readFileSync, writeFileSync } from 'fs';
import { parseDsl } from '../parser/parser.js';
import { applyLayout } from '../layout/elk-layout.js';
import { generateVsdx } from '../generator/vsdx-generator.js';

/**
 * Test bout en bout : DSL → AST → layout → .vsdx
 *
 * Lance avec : npm run test:vsdx
 */

const dslContent = readFileSync('examples/ecommerce.dsl', 'utf-8');

console.log('=== Étape 1 : Parsing ===');
const parseResult = parseDsl(dslContent);
if (parseResult.errors.length > 0) {
  console.error('Erreurs de parsing :');
  for (const err of parseResult.errors) {
    console.error(`  - ${err.message} (ligne ${err.line ?? '?'})`);
  }
  process.exit(1);
}
const diagram = parseResult.diagram!;
console.log(`✓ Diagramme "${diagram.title}"`);
console.log(`  ${diagram.nodes.length} noeuds, ${diagram.edges.length} edges`);

console.log('\n=== Étape 2 : Layout (ELK) ===');
await applyLayout(diagram);
console.log('✓ Positions calculées');
for (const node of diagram.nodes.slice(0, 3)) {
  console.log(
    `  ${node.id}: x=${node.x?.toFixed(0)} y=${node.y?.toFixed(0)} w=${node.width} h=${node.height}`,
  );
}
console.log('  ...');

console.log('\n=== Étape 3 : Génération .vsdx ===');
const buffer = await generateVsdx(diagram);
const outPath = 'output.vsdx';
writeFileSync(outPath, buffer);
console.log(`✓ Fichier généré : ${outPath} (${buffer.length} octets)`);
console.log('\nOuvre output.vsdx avec Microsoft Visio pour valider.');

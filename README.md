# Visio DSL Generator

Génère des diagrammes d'architecture logicielle au format Visio (`.vsdx`)
à partir d'un DSL textuel simple.

## Démarrage rapide

```bash
npm install
npm run test:vsdx     # Test bout en bout : génère output.vsdx
npm run dev           # Lance le serveur d'API sur :3000
```

## Architecture

```
DSL text → Parser (Chevrotain) → AST → Layout (ELK) → Générateur .vsdx (JSZip + XML)
```

### Modules

| Module | Rôle |
|---|---|
| `src/parser/lexer.ts` | Tokenizer du DSL |
| `src/parser/parser.ts` | Grammaire + visitor → AST |
| `src/types.ts` | Modèle de données central |
| `src/generator/templates.ts` | Bibliothèque de modèles visuels par type |
| `src/generator/page-xml.ts` | Génère le XML d'une page Visio |
| `src/generator/vsdx-generator.ts` | Assemble le ZIP `.vsdx` complet |
| `src/layout/elk-layout.ts` | Calcule les positions via ELK |
| `src/api/server.ts` | API HTTP Fastify |

## Le DSL

Voir `examples/ecommerce.dsl` pour un exemple complet. Syntaxe :

```
diagram "Titre" {
  component  myid as "Label" { tech: "..." }
  service    myid as "Label" { ... }
  database   myid as "Label" { tech: "PostgreSQL" }
  queue      myid as "Label"
  external   myid as "Label"
  actor      myid as "Label"

  group grpid as "Mon groupe" {
    contains: myid1, myid2
  }

  myid1 -> myid2: "relation synchrone"
  myid1 ..> myid3: "relation asynchrone"
}
```

## Modèles visuels (stencils)

### Built-in
Définis dans `src/generator/templates.ts`. Couleurs, formes, dimensions
par défaut pour chaque `kind` (component, service, database, etc.).

### Stencil utilisateur
Le générateur accepte un mapping optionnel vers un Master Shape d'un stencil
Visio personnalisé :

```typescript
const stencilMapping = {
  service: { stencilName: 'Mon Stencil', masterId: '42' },
};
```

Le support complet (lecture du `.vssx`, copie des Masters dans le `.vsdx`
généré) est à implémenter — voir Roadmap.

## API HTTP

| Endpoint | Description |
|---|---|
| `POST /api/parse` | DSL → JSON (AST + layout) — pour la preview live |
| `POST /api/generate` | DSL → fichier `.vsdx` |

## Roadmap

### v0.1 (POC actuel)
- [x] Parser DSL
- [x] Layout ELK
- [x] Génération `.vsdx` minimal (rectangles + connecteurs)
- [x] API Fastify

### v0.2
- [ ] Formes différenciées (cylindre, parallélogramme via Geom Sections)
- [ ] Frontend React + Monaco + preview SVG live
- [ ] Tests unitaires (Vitest)

### v0.3
- [ ] Import et utilisation de stencils `.vssx` utilisateur
- [ ] Support multi-pages (un diagramme par page)
- [ ] Coloration syntaxique Monaco basée sur la grammaire Chevrotain
- [ ] Autocomplétion des identifiants

### v1.0
- [ ] LSP complet (Langium ou tsserver-style)
- [ ] Validation sémantique enrichie (cycles, doublons, refs orphelines)
- [ ] Export complémentaire en SVG / PNG / Mermaid
- [ ] Sauvegarde / partage de diagrammes (auth utilisateur)

## Notes techniques importantes

**Format .vsdx** : un ZIP de XML suivant la spec OOXML Visio. Notre générateur
écrit le strict minimum pour qu'un fichier soit valide. Si un test échoue à
l'ouverture dans Visio, vérifier en priorité :
- Le namespace `xmlns="http://schemas.microsoft.com/office/visio/2012/main"`
- La cohérence des `Relationship Id` entre `.rels` et fichiers cibles
- Les coordonnées : Visio utilise des **pouces**, origine **bottom-left**

**Layout** : ELK est lourd (~500 KB) mais c'est le meilleur algorithme libre
pour ce cas d'usage. Pour économiser, on peut le faire tourner côté backend
uniquement et n'envoyer au frontend que le résultat (positions calculées) à
afficher en SVG simple.

import JSZip from 'jszip';
import { Diagram } from '../types.js';
import { generatePageXml } from './page-xml.js';
import { StencilMapping } from './templates.js';

/**
 * Un .vsdx est un ZIP contenant une structure OOXML précise :
 *
 *   [Content_Types].xml      → liste les types MIME utilisés
 *   _rels/.rels              → relations racine
 *   docProps/app.xml         → métadonnées applicatives
 *   docProps/core.xml        → métadonnées de base (auteur, date...)
 *   visio/document.xml       → doc principal, liste les pages
 *   visio/_rels/document.xml.rels  → relations du document
 *   visio/pages/pages.xml    → liste des pages avec leur taille
 *   visio/pages/_rels/pages.xml.rels  → relations vers chaque page
 *   visio/pages/page1.xml    → contenu de la page 1 (formes)
 *   visio/windows.xml        → état des fenêtres (peut être vide)
 *
 * On génère le minimum vital pour qu'un fichier soit valide et s'ouvre
 * dans Visio sans erreur.
 */

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
  <Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_XML = `<?xml version="1.0" encoding="utf-8" ?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <DocumentSettings TopPage="0" DefaultTextStyle="3" DefaultLineStyle="3" DefaultFillStyle="3" DefaultGuideStyle="4">
    <GlyphSettings/>
  </DocumentSettings>
</VisioDocument>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>
</Relationships>`;

const PAGES_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <Page ID="0" NameU="Page-1" Name="Page-1" ViewScale="-1" ViewCenterX="8.25" ViewCenterY="5.85">
    <PageSheet LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PageWidth" V="16.5"/>
      <Cell N="PageHeight" V="11.7"/>
      <Cell N="ShdwOffsetX" V="0.125"/>
      <Cell N="ShdwOffsetY" V="-0.125"/>
      <Cell N="PageScale" V="1" U="IN_F"/>
      <Cell N="DrawingScale" V="1" U="IN_F"/>
      <Cell N="DrawingSizeType" V="3"/>
      <Cell N="DrawingScaleType" V="0"/>
      <Cell N="InhibitSnap" V="0"/>
      <Cell N="PageLockReplace" V="0" U="BOOL"/>
      <Cell N="PageLockDuplicate" V="0" U="BOOL"/>
      <Cell N="UIVisibility" V="0"/>
      <Cell N="ShdwType" V="0"/>
      <Cell N="ShdwObliqueAngle" V="0"/>
      <Cell N="ShdwScaleFactor" V="1"/>
    </PageSheet>
    <Rel r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </Page>
</Pages>`;

const PAGES_RELS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;

const WINDOWS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Windows xmlns="http://schemas.microsoft.com/office/visio/2012/main" ClientWidth="1920" ClientHeight="1080" xml:space="preserve">
</Windows>`;

const APP_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>visio-dsl-generator</Application>
  <AppVersion>0.1</AppVersion>
</Properties>`;

function generateCoreXml(title: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8" ?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>visio-dsl-generator</dc:creator>
  <cp:lastModifiedBy>visio-dsl-generator</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Génère un Buffer contenant le .vsdx complet.
 */
export async function generateVsdx(
  diagram: Diagram,
  stencilMapping?: StencilMapping,
): Promise<Buffer> {
  const zip = new JSZip();

  // Structure de base
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')!.file('.rels', ROOT_RELS_XML);
  zip.folder('docProps')!.file('app.xml', APP_XML);
  zip.folder('docProps')!.file('core.xml', generateCoreXml(diagram.title));

  const visio = zip.folder('visio')!;
  visio.file('document.xml', DOCUMENT_XML);
  visio.file('windows.xml', WINDOWS_XML);
  visio.folder('_rels')!.file('document.xml.rels', DOCUMENT_RELS_XML);

  const pages = visio.folder('pages')!;
  pages.file('pages.xml', PAGES_XML);
  pages.folder('_rels')!.file('pages.xml.rels', PAGES_RELS_XML);
  pages.file('page1.xml', generatePageXml(diagram, stencilMapping));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

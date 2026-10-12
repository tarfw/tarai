import { defaultBlueprint, buildSite } from '../src/site/build.ts';
import { compileDocument } from '../src/site/compile.ts';
import { DOCUMENT_VERSION } from '../src/site/document.ts';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const blueprint = defaultBlueprint(['products']);
  const brief = {
    goal: 'Activewear, loungewear and contemporary lifestyle wardrobe.',
    audience: 'women seeking modern minimalist activewear',
    tone: 'restrained editorial',
  };
  const built = buildSite({
    title: 'Adanola',
    brief,
    facts: {},
    blueprint,
    assets: [],
  });

  const site = built.doc;
  const origin = 'https://tar-sites.tar-54d.workers.dev/ws14';
  const compiled = await compileDocument(site, { origin });

  const releaseId = `rel_${crypto.randomUUID()}`;
  const workspaceId = 'ws_ae08c15d-6222-4882-bc29-e62a9dcd3891';
  const siteId = 'site_f355e4d3-292e-4537-a221-bd023ac67647';
  const prefix = `workspaces/${workspaceId}/sites/${siteId}/releases`;

  const files = compiled.files.map((file) => {
    const bytes = typeof file.body === 'string' ? new TextEncoder().encode(file.body).byteLength : file.body.byteLength;
    return {
      path: file.path,
      mime: file.mime,
      bytes,
      hash: file.hash,
      key: `${prefix}/${releaseId}${file.path}`,
    };
  });

  const manifest = {
    id: releaseId,
    siteId,
    epoch: 24,
    host: 'tar-sites.tar-54d.workers.dev',
    version: 52,
    generation: 24,
    created: Date.now(),
    hash: compiled.hash,
    files,
    compiler: DOCUMENT_VERSION,
    redirects: compiled.redirects,
    checks: { blocking: 0, advisory: 0 },
  };

  const outDir = path.join(process.cwd(), 'out_ws14');
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of compiled.files) {
    const localRel = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    const filePath = path.join(outDir, localRel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (typeof file.body === 'string') {
      fs.writeFileSync(filePath, file.body, 'utf-8');
    } else {
      fs.writeFileSync(filePath, Buffer.from(file.body));
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'source.json'), JSON.stringify({ ...site, currentRelease: releaseId }, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ inspection: { blocking: [], advisory: [] }, created: Date.now() }), 'utf-8');

  console.log(JSON.stringify({
    releaseId,
    hash: compiled.hash,
    fileCount: files.length,
    files: files.map((f) => f.path),
  }, null, 2));
}

main().catch(console.error);

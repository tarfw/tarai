/**
 * Design library build glue (parai §3.2). All interpretation is in src/site/designs;
 * this file only reads `designmds/*.md`, writes the committed artifacts, and reports.
 *
 *   npm run designs                   rewrite src/site/designs/{index,review}.json, tokens/, library.generated.ts
 *   npm run designs -- --check        exit 1 if the committed output is stale
 *   npm run designs -- --print-tags   print sidecar entries for a person to sign
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildLibrary, LIBRARY_VOCABULARY, renderJson } from '../src/site/designs/build.ts';
import { OUT_DIR, differs, readSidecar, readSources, TOKENS_DIR } from './digestsources.ts';

interface Artifact {
  target: string;
  text: string;
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const printTags = args.includes('--print-tags');

  const build = buildLibrary(readSources(), readSidecar(), LIBRARY_VOCABULARY);

  if (printTags) {
    console.log(JSON.stringify(build.proposals, null, 2));
    return;
  }

  if (build.errors.length) {
    for (const error of build.errors) console.error(`designs: ${error}`);
    process.exitCode = 1;
    return;
  }

  const artifacts: Artifact[] = [
    { target: path.join(OUT_DIR, 'index.json'), text: renderJson(build.index) },
    { target: path.join(OUT_DIR, 'review.json'), text: renderJson(build.review) },
    ...build.tokens.map((entry) => ({ target: path.join(TOKENS_DIR, `${entry.id}.json`), text: entry.text })),
    { target: path.join(OUT_DIR, 'library.generated.ts'), text: build.library },
  ];

  const drift = artifacts.filter((artifact) => differs(artifact.target, artifact.text));
  if (drift.length && check) {
    for (const artifact of drift) console.error(`designs: stale ${path.relative(process.cwd(), artifact.target)}`);
    console.error('Run `npm run designs` and commit the result.');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(TOKENS_DIR, { recursive: true });
  for (const artifact of artifacts) fs.writeFileSync(artifact.target, artifact.text);

  const keep = new Set(artifacts.map((artifact) => path.basename(artifact.target)));
  for (const name of fs.readdirSync(TOKENS_DIR)) {
    if (name.endsWith('.json') && !keep.has(name)) {
      fs.rmSync(path.join(TOKENS_DIR, name));
      console.log(`designs: removed unshipped ${name}`);
    }
  }

  console.log(`designs: ${build.index.designs.length} shipped (${build.index.default} default), ${build.review.excluded.length} in review, ${build.review.notes.length} with notes`);
  for (const entry of build.review.excluded) {
    console.log(`  review ${entry.file}: ${entry.findings.map((finding) => finding.message).join(' ')}`);
  }
  if (Object.keys(build.proposals).length) {
    console.log(`  unsigned: ${Object.keys(build.proposals).join(', ')} — npm run designs -- --print-tags`);
  }
}

main();

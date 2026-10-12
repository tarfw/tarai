/**
 * Recipe library build glue (parai §5.4). Interpretation lives in src/site/recipes; this
 * file reads `src/site/recipes/<type>/<id>.json`, resolves every slot against the sample
 * profile, writes the generated import map, and reports.
 *
 *   npm run recipes              rewrite src/site/recipes/library.generated.ts
 *   npm run recipes -- --check   exit 1 if the committed map is stale
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildRecipes } from '../src/site/recipes/build.ts';
import { RECIPE_DIR, differs, readRecipeSources } from './digestsources.ts';
import { sampleFacts } from '../test/fixtures/sample-profile.ts';

const LIBRARY_FILE = path.join(RECIPE_DIR, 'library.generated.ts');

function main(): void {
  const check = process.argv.slice(2).includes('--check');
  const sources = readRecipeSources();
  const build = buildRecipes(sources, sampleFacts);

  if (build.errors.length) {
    for (const error of build.errors) console.error(`recipes: ${error}`);
    process.exitCode = 1;
    return;
  }

  if (differs(LIBRARY_FILE, build.library)) {
    if (check) {
      console.error(`recipes: stale ${path.relative(process.cwd(), LIBRARY_FILE)}`);
      console.error('Run `npm run recipes` and commit the result.');
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(LIBRARY_FILE, build.library);
  }

  console.log(`recipes: ${build.recipes.length} shipped across ${new Set(build.recipes.map((entry) => entry.recipe.type)).size} types`);
  for (const entry of build.excluded) console.log(`  rejected ${entry.file}: ${entry.problems.join(' ')}`);
  for (const entry of build.unfillable) console.log(`  unfillable ${entry.file}: no sample content for ${entry.missing.join(', ')}`);
}

main();

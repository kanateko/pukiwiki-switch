import { build } from 'esbuild';
import * as sass from 'sass';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PLUGIN_NAME = 'switch';

async function main() {
  try {
    console.log(`🚀 Building ${PLUGIN_NAME}...`);

    // 1. TypeScript -> minified JS
    console.log('📦 Compiling TypeScript...');
    const jsResult = await build({
      entryPoints: [`src/ts/${PLUGIN_NAME}.ts`],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
    });
    const minifiedJs = jsResult.outputFiles[0].text;

    // 2. SCSS -> CSS -> autoprefixer -> minify
    console.log('🎨 Compiling SCSS...');
    const sassResult = sass.compile(`src/css/${PLUGIN_NAME}.scss`, { style: 'compressed' });
    const postcssResult = await postcss([autoprefixer]).process(sassResult.css, {
      from: undefined,
    });
    const minifiedCss = postcssResult.css;

    // 3. PHP source integration
    console.log('🐘 Integrating PHP...');
    let php = readFileSync(`src/${PLUGIN_NAME}.php`, 'utf8');
    php = php
      .replace('/* minified css here */', () => minifiedCss.trim())
      .replace('/* minified js here */', () => minifiedJs.trim());

    if (!existsSync('dist')) {
      mkdirSync('dist');
    }

    writeFileSync(`dist/${PLUGIN_NAME}.inc.php`, php);
    console.log(`✅ dist/${PLUGIN_NAME}.inc.php を生成しました`);
  } catch (e) {
    console.error('❌ Build failed:', e);
    process.exit(1);
  }
}

main();

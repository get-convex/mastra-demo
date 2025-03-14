import type { Logger } from '@mastra/core';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import virtual from '@rollup/plugin-virtual';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rollup, type Plugin } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

import { isNodeBuiltin } from './isNodeBuiltin';
import { aliasHono } from './plugins/hono-alias';
import { pino } from './plugins/pino';
import { removeDeployer } from './plugins/remove-deployer';

/**
 * Analyzes the entry file to identify dependencies that need optimization.
 * This is the first step of the bundle analysis process.
 *
 * @param entry - The entry file path or content
 * @param mastraEntry - The mastra entry point
 * @param isVirtualFile - Whether the entry is a virtual file (content string) or a file path
 * @param platform - Target platform (node or browser)
 * @param logger - Logger instance for debugging
 * @returns Map of dependencies to optimize with their exported bindings
 */
async function analyze(
  entry: string,
  mastraEntry: string,
  isVirtualFile: boolean,
  platform: 'node' | 'browser',
  logger: Logger,
) {
  logger.info('Analyzing dependencies...');
  let virtualPlugin = null;
  if (isVirtualFile) {
    virtualPlugin = virtual({
      '#entry': entry,
    });
    entry = '#entry';
  }

  const optimizerBundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: isVirtualFile ? '#entry' : entry,
    treeshake: true,
    preserveSymlinks: true,
    plugins: [
      virtualPlugin,
      {
        name: 'custom-alias-resolver',
        resolveId(id: string) {
          if (id === '#server') {
            return fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/');
          }
          if (id === '#mastra') {
            return mastraEntry.replaceAll('\\', '/');
          }
        },
      } satisfies Plugin,
      json(),
      esbuild({
        target: 'node20',
        platform,
        minify: false,
      }),
      commonjs({
        strictRequires: 'debug',
        ignoreTryCatch: false,
        transformMixedEsModules: true,
        extensions: ['.js', '.ts'],
      }),
      removeDeployer(mastraEntry),
      esbuild({
        target: 'node20',
        platform,
        minify: false,
      }),
    ].filter(Boolean),
  });

  const { output } = await optimizerBundler.generate({
    format: 'esm',
    inlineDynamicImports: true,
  });

  await optimizerBundler.close();

  const depsToOptimize = new Map(Object.entries(output[0].importedBindings));
  for (const dep of depsToOptimize.keys()) {
    if (isNodeBuiltin(dep)) {
      depsToOptimize.delete(dep);
    }
  }

  return depsToOptimize;
}

/**
 * Bundles vendor dependencies identified in the analysis step.
 * Creates virtual modules for each dependency and bundles them using rollup.
 *
 * @param depsToOptimize - Map of dependencies with their exports from analyze step
 * @param outputDir - Directory where bundled files will be written
 * @param logger - Logger instance for debugging
 * @returns Object containing bundle output and reference map for validation
 */
async function bundleExternals(depsToOptimize: Map<string, string[]>, outputDir: string, logger: Logger) {
  logger.info('Optimizing dependencies...');
  logger.debug(
    `${Array.from(depsToOptimize.keys())
      .map(key => `- ${key}`)
      .join('\n')}`,
  );

  const reverseVirtualReferenceMap = new Map<string, string>();
  const virtualDependencies = new Map();
  for (const [dep, exports] of depsToOptimize.entries()) {
    const name = dep.replaceAll('/', '-');
    reverseVirtualReferenceMap.set(name, dep);

    const virtualFile: string[] = [];
    let exportStringBuilder = [];
    for (const local of exports) {
      if (local === '*') {
        virtualFile.push(`export * from '${dep}';`);
      } else if (local === 'default') {
        virtualFile.push(`export * from '${dep}';`);
      } else {
        exportStringBuilder.push(local);
      }
    }

    if (exportStringBuilder.length > 0) {
      virtualFile.push(`export { ${exportStringBuilder.join(', ')} } from '${dep}';`);
    }

    virtualDependencies.set(dep, {
      name,
      virtual: virtualFile.join('\n'),
    });
  }

  const bundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: Array.from(virtualDependencies.entries()).reduce(
      (acc, [dep, virtualDep]) => {
        acc[virtualDep.name] = `#virtual-${dep}`;
        return acc;
      },
      {} as Record<string, string>,
    ),
    // this dependency breaks the build, so we need to exclude it
    // TODO actually fix this so we don't need to exclude it
    external: ['jsdom'],
    treeshake: 'smallest',
    preserveSymlinks: true,
    plugins: [
      virtual(
        Array.from(virtualDependencies.entries()).reduce(
          (acc, [dep, virtualDep]) => {
            acc[`#virtual-${dep}`] = virtualDep.virtual;
            return acc;
          },
          {} as Record<string, string>,
        ),
      ),
      pino(),
      commonjs({
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
      nodeResolve({
        preferBuiltins: true,
        exportConditions: ['node', 'import', 'require'],
        mainFields: ['module', 'main'],
      }),
      // hono is imported from deployer, so we need to resolve from here instead of the project root
      aliasHono(),
      json(),
    ].filter(Boolean),
  });

  const { output } = await bundler.write({
    format: 'esm',
    dir: outputDir,
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name].mjs',
  });

  await bundler.close();

  return { output, reverseVirtualReferenceMap };
}

/**
 * Validates the bundled output by attempting to import each generated module.
 * Tracks invalid chunks and external dependencies that couldn't be bundled.
 *
 * @param output - Bundle output from rollup
 * @param reverseVirtualReferenceMap - Map to resolve virtual module names back to original deps
 * @param outputDir - Directory containing the bundled files
 * @param logger - Logger instance for debugging
 * @returns Analysis result containing invalid chunks and dependency mappings
 */
async function validateOutput(
  output: any[],
  reverseVirtualReferenceMap: Map<string, string>,
  outputDir: string,
  logger: Logger,
) {
  const result = {
    invalidChunks: new Set<string>(),
    dependencies: new Map<string, string>(),
    externalDependencies: new Set<string>(),
  };

  //const internalFiles = new Set<string>(output.map(file => file.fileName));

  for (const file of output) {
    if (file.type === 'asset') {
      continue;
    }

    try {
      logger.debug(`Validating if ${file.fileName} is a valid module.`);
      if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
        result.dependencies.set(reverseVirtualReferenceMap.get(file.name)!, file.fileName);
      }

      await import(`file:${outputDir}/${file.fileName}`);
    } catch (err) {
      result.invalidChunks.add(file.fileName);
      if (file.isEntry && reverseVirtualReferenceMap.has(file.name)) {
        result.externalDependencies.add(reverseVirtualReferenceMap.get(file.name)!);
      }

      // we might need this on other projects but not sure so let's keep it commented out for now
      // console.log(file.fileName, file.isEntry, file.isDynamicEntry, err);
      // result.invalidChunks.add(file.fileName);
      // const externalImports = excludeInternalDeps(file.imports.filter(file => !internalFiles.has(file)));
      // externalImports.push(...excludeInternalDeps(file.dynamicImports.filter(file => !internalFiles.has(file))));
      // for (const externalImport of externalImports) {
      //   result.externalDependencies.add(externalImport);
      // }

      // if (reverseVirtualReferenceMap.has(file.name)) {
      //   result.externalDependencies.add(reverseVirtualReferenceMap.get(file.name)!);
      // }
    }
  }

  return result;
}

/**
 * Main bundle analysis function that orchestrates the three-step process:
 * 1. Analyze dependencies
 * 2. Bundle dependencies modules
 * 3. Validate generated bundles
 *
 * This helps identify which dependencies need to be externalized vs bundled.
 */
export async function analyzeBundle(
  entry: string,
  mastraEntry: string,
  outputDir: string,
  platform: 'node' | 'browser',
  logger: Logger,
) {
  const isVirtualFile = entry.includes('\n') || !existsSync(entry);

  const depsToOptimize = await analyze(entry, mastraEntry, isVirtualFile, platform, logger);
  const { output, reverseVirtualReferenceMap } = await bundleExternals(depsToOptimize, outputDir, logger);
  const result = await validateOutput(output, reverseVirtualReferenceMap, outputDir, logger);

  return result;
}

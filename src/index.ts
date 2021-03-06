/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CompileOptions } from 'google-closure-compiler';
import * as fs from 'fs';
import { promisify } from 'util';
import { OutputOptions, RawSourceMap, Plugin, OutputChunk } from 'rollup';
import compiler from './compiler';
import options from './options';
import { preCompilation, createTransforms, deriveFromInputSource } from './transforms';
import { Transform } from './types';

const readFile = promisify(fs.readFile);

/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
export const transformChunk = async (
  transforms: Array<Transform>,
  requestedCompileOptions: CompileOptions,
  sourceCode: string,
  outputOptions: OutputOptions,
): Promise<{ code: string; map: RawSourceMap } | void> => {
  const code = await preCompilation(sourceCode, outputOptions, transforms);
  const [compileOptions, mapFile] = options(
    requestedCompileOptions,
    outputOptions,
    code,
    transforms,
  );

  return compiler(compileOptions, transforms).then(
    async code => {
      return { code, map: JSON.parse(await readFile(mapFile, 'utf8')) };
    },
    (error: Error) => {
      throw error;
    },
  );
};

export default function closureCompiler(requestedCompileOptions: CompileOptions = {}): Plugin {
  let transforms: Array<Transform>;

  return {
    name: 'closure-compiler',
    load() {
      transforms = transforms || createTransforms(this);
    },
    transform: async (code: string) => deriveFromInputSource(code, transforms),
    transformChunk: async (code: string, outputOptions: OutputOptions, chunk: OutputChunk) =>
      await transformChunk(transforms, requestedCompileOptions, code, outputOptions),
  };
}

import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'career-tests-'));
try{const file=join(dir,'core.test.mjs');await build({entryPoints:['tests/core.test.ts'],bundle:true,platform:'node',format:'esm',outfile:file});const result=spawnSync(process.execPath,['--test',file],{stdio:'inherit'});process.exitCode=result.status??1}finally{await rm(dir,{recursive:true,force:true})}

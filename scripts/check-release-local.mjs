import {spawnSync,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const out=process.env.TRADEIFY_VERIFICATION_DIR??'documentacion/verificacion-seguridad-2026-11-22';await mkdir(out,{recursive:true});
const base={...process.env};delete base.TRADEIFY_TARGET;delete base.TRADEIFY_D1_ID;delete base.TRADEIFY_R2_BUCKET;
const fixture={...base,TRADEIFY_D1_ID:'11111111-1111-4111-8111-111111111111'};
const commands=[
 ['typecheck',['npm','run','typecheck'],base],['lint',['npm','run','lint'],base],['logic',['npm','run','test:logic'],base],
 ['advanced',['npm','run','test:advanced'],base],['queries',['npm','run','test:queries'],base],['restore',['npm','run','test:restore'],base],['exports',['npm','run','test:exports'],base],
 ['build-site',['npm','run','build'],base],['api',['npm','run','test:api'],base],
 ['build-cloudflare-r2',['npm','run','build:cloudflare'],{...fixture,TRADEIFY_R2_BUCKET:'tradeify-local-test'}],
 ['cloudflare-r2',['npm','run','test:cloudflare'],base],['app-security',['npm','run','test:app-security'],base],['security-regressions',['npm','run','test:security'],base],['operational-recovery',['npm','run','test:recovery'],base],
 ['build-cloudflare-without-r2',['npm','run','build:cloudflare'],fixture],['cloudflare-without-r2',['npm','run','test:cloudflare'],base],
 ['audit-production',['npm','audit','--omit=dev','--json'],base],['audit-development',['npm','audit','--json'],base],
];
const result={auditInitialCommit:'84dc36a8a78e662ea04bdf70cc4e1bb3f74cea10',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Local; servicios y credenciales ficticios, D1/R2 desechables. No certifica producción ni navegador.',checks:[]};
for(const [name,[command,...args],env]of commands){const at=performance.now(),run=spawnSync(command,args,{env,encoding:'utf8',timeout:600000,maxBuffer:20*1024*1024});const log=(run.stdout??'')+(run.stderr??'')+(run.error?'\n'+run.error.message:'');await writeFile(out+'/'+name+'.txt',log);let status=run.status===0?'passed':'failed';if(name==='audit-development'&&run.status===1){try{const v=JSON.parse(run.stdout).metadata.vulnerabilities;if(v.total===4&&v.moderate===4&&!v.high&&!v.critical)status='known-advisories';}catch{}}
 result.checks.push({name,command:[command,...args],exitCode:run.status,status,seconds:Math.round((performance.now()-at)/10)/100,evidence:name+'.txt'});await writeFile(out+'/resultados.json',JSON.stringify(result,null,2)+'\n');console.log(name+': '+status+' ('+run.status+')');}
process.exitCode=result.checks.some(c=>c.status==='failed')?1:0;

import {execFileSync} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=process.argv[2]??'documentacion/verificacion-seguridad-2026-11-22';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128*1024*1024});
// Candidate detectors, NOT proof that all possible secret formats are absent.
// Never print matching values, surrounding source or raw environment contents.
const detectors=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
 ['google-client-secret',/\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g],
 ['mail-api-key',/\bre_[A-Za-z0-9_-]{24,}\b/g],
 ['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['assigned-secret',/(?:TRADEIFY_SESSION_SECRET|TRADEIFY_GOOGLE_CLIENT_SECRET|TRADEIFY_EMAIL_API_KEY|CLOUDFLARE_API_TOKEN)["']?\s*[=:]\s*(?:["'][^"'\r\n]{24,}["']|[A-Za-z0-9_-]{24,})/g]
];
const candidates=[];let blobs=0,compiled=0;
function scan(text,location){for(const [kind,regex]of detectors){regex.lastIndex=0;for(const match of text.matchAll(regex)){const line=text.slice(0,match.index).split('\n').length;candidates.push({kind,location,line,evidence:'[REDACTADO: revisar en origen sin copiar valor]'});}}}
const objects=git('rev-list','--objects','--all').trim().split('\n').filter(Boolean);
const sizes=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:objects.map(row=>row.split(' ')[0]).join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024}).trim().split('\n');
for(let i=0;i<sizes.length;i++){const [sha,type,size]=sizes[i].split(' ');if(type!=='blob'||Number(size)>5_000_000)continue;const filename=objects[i].slice(41);if(/\.(?:png|pdf|xlsx|woff2|zip)$/.test(filename))continue;scan(git('cat-file','blob',sha),sha+':'+filename);blobs++;}
const messages=git('log','--all','--format=%H%x00%B%x00').split('\0');for(let i=0;i+1<messages.length;i+=2)scan(messages[i+1],'commit-message:'+messages[i].trim());
const tracked=git('ls-files','-z').split('\0').filter(Boolean);for(const file of tracked)if(!/\.(?:png|pdf|xlsx|woff2|zip)$/.test(file))scan(await readFile(file,'utf8'),'working:'+file);
async function walk(dir){try{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(?:js|mjs|map|json|html|txt)$/.test(file)){scan(await readFile(file,'utf8'),'build:'+file);compiled++;}}}catch(error){if(error.code!=='ENOENT')throw error;}}
await walk('dist');
const localConfiguration=(await readdir('.')).filter(name=>/^\.env|^\.dev\.vars/.test(name));
for(const file of localConfiguration)scan(await readFile(file,'utf8'),'local-config:'+file);
const environmentNames=Object.keys(process.env).filter(name=>/CLOUDFLARE|TRADEIFY|GOOGLE|TOKEN|SECRET|PRIVATE_KEY/.test(name)).map(name=>({name,present:!!process.env[name]}));
const report={scope:'Historial Git alcanzable local, árbol tracked, dist actual, configuraciones locales y nombres de variables; NO panel/secretos remotos, ni escáner semántico universal',commit:git('rev-parse','HEAD').trim(),commits:Number(git('rev-list','--all','--count')),historicalBlobsScanned:blobs,trackedFilesScanned:tracked.length,compiledFilesScanned:compiled,localConfiguration,environmentNames,candidates};
await mkdir(out,{recursive:true});await writeFile(out+'/secret-scan.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({historicalBlobsScanned:blobs,compiledFilesScanned:compiled,candidates:candidates.length,report:out+'/secret-scan.json'}));

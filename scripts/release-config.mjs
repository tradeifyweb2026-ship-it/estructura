/** Build-time target selection. No credentials, runtime secrets or provisioning. */
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const worker=/^[a-z0-9][a-z0-9-]{0,62}$/;
const bucket=/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
export const fixtureIds=new Set(['00000000-0000-4000-8000-000000000000','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']);
export function releaseTarget(env=process.env){
 const environment=env.TRADEIFY_DEPLOY_ENV??'validation',workerName=env.TRADEIFY_WORKER_NAME?.trim()||'tradeify',databaseName=env.TRADEIFY_D1_NAME?.trim()||'tradeify',databaseId=env.TRADEIFY_D1_ID?.trim(),bucketName=env.TRADEIFY_R2_BUCKET?.trim()||null,accountId=env.CLOUDFLARE_ACCOUNT_ID?.trim()||null;
 if(!['validation','staging','production'].includes(environment))throw Error('TRADEIFY_DEPLOY_ENV debe ser validation, staging o production.');
 if(!databaseId||!uuid.test(databaseId)||databaseId==='00000000-0000-4000-8000-000000000000')throw Error('Configura TRADEIFY_D1_ID con el UUID de tu base D1.');
 if(!worker.test(workerName)||!worker.test(databaseName)||bucketName&&!bucket.test(bucketName))throw Error('Revisa el nombre del Worker, D1 o bucket; no uses rutas ni espacios.');
 if(accountId&&!/^[0-9a-f]{32}$/i.test(accountId))throw Error('CLOUDFLARE_ACCOUNT_ID debe ser el identificador de cuenta, no un token.');
 if(environment==='staging'){
  const productionDatabaseId=env.TRADEIFY_PRODUCTION_D1_ID?.trim(),productionWorker=env.TRADEIFY_PRODUCTION_WORKER_NAME?.trim()||'tradeify',productionBucket=env.TRADEIFY_PRODUCTION_R2_BUCKET?.trim();
  if(!env.TRADEIFY_WORKER_NAME||workerName===productionWorker||!productionDatabaseId||!uuid.test(productionDatabaseId)||databaseId.toLowerCase()===productionDatabaseId.toLowerCase())throw Error('Staging necesita un Worker y un D1 distintos de producción. Confirma TRADEIFY_PRODUCTION_D1_ID antes de compilar.');
  if(bucketName&&(!productionBucket||productionBucket!=='NONE'&&bucketName===productionBucket))throw Error('Confirma TRADEIFY_PRODUCTION_R2_BUCKET y usa otro bucket privado para staging. Usa NONE solo si verificaste que producción no tiene R2.');
 }
 return {environment,workerName,databaseName,databaseId,bucketName,accountId};
}
export function validateGeneratedConfig(config,target){
 const db=config.d1_databases?.find(x=>x.binding==='DB'),r2=config.r2_buckets?.find(x=>x.binding==='BUCKET');
 if(config.name!==target.workerName||db?.database_id!==target.databaseId||db?.database_name!==target.databaseName||(r2?.bucket_name??null)!==target.bucketName||(config.account_id??null)!==target.accountId)throw Error('La compilación no coincide con el destino. Vuelve a compilar con los mismos valores y no edites dist.');
 if((config.d1_databases?.length??0)!==1||(config.r2_buckets?.length??0)!==Number(!!target.bucketName))throw Error('Bindings inesperados: revisa el destino antes de publicar.');
}
export function requireRemoteTarget(target){
 if(target.environment==='validation'||fixtureIds.has(target.databaseId)||!target.accountId)throw Error('Operación remota bloqueada: configura entorno, cuenta e identificadores reales; no se usan fixtures para servicios reales.');
}
export function deploymentArgs(target,commit,approvedCommit){
 requireRemoteTarget(target);
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('No se pudo fijar el commit de la compilación.');
 if(target.environment==='production'&&approvedCommit!==commit)throw Error('Producción requiere la aprobación final de este commit exacto. Configura TRADEIFY_APPROVED_DEPLOY_SHA solo después de esa aprobación.');
 return ['deploy','--config','dist/server/wrangler.json','--keep-vars','--tag','v2-'+commit.slice(0,12),'--message','Tradeify V2 '+commit];
}

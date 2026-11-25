import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {releaseTarget,deploymentArgs} from "./release-config.mjs";
import {sealBuild,verifyBuild,assertCleanSource,inspectSchema} from "./release-tools.mjs";

function run(relativePath, args, env = process.env) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  const result = spawnSync(process.execPath, [path, ...args], { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const wrangler = "../node_modules/wrangler/bin/wrangler.js";
const output = "dist/server/wrangler.json";
const [command] = process.argv.slice(2);

if (command === "build") {
  run("../node_modules/vinext/dist/cli.js", ["build"], { ...process.env, TRADEIFY_TARGET: "cloudflare" });
  const manifest=sealBuild(releaseTarget());
  console.log("Artefacto Cloudflare fijado al commit "+manifest.source+" ("+manifest.target.environment+").");
} else if (command === "deploy") {
  const target=releaseTarget();
  assertCleanSource();
  const manifest=verifyBuild(target);
  if(manifest.sourceClean!==true)throw new Error('La compilación incluyó cambios sin registrar. Compila de nuevo desde una copia Git limpia antes de publicar.');
  const args=deploymentArgs(target,manifest.source,process.env.TRADEIFY_APPROVED_DEPLOY_SHA);
  const inspection=inspectSchema(target);
  if(!inspection.ready)throw new Error("El esquema o registro de migraciones requiere revisión. Ejecuta release:inspect y aprueba el plan por separado; deploy nunca aplica migraciones.");
  verifyBuild(target);
  run(wrangler,args);
} else if(command==='dry-run'){
  verifyBuild(releaseTarget());
  run(wrangler,['deploy','--config',output,'--keep-vars','--dry-run']);
} else {
  throw new Error("Usa build, dry-run o deploy. Las migraciones se revisan y ejecutan por separado.");
}

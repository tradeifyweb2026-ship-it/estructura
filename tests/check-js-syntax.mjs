import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
let count=0;
function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
 if(["node_modules",".git",".wrangler",".vinext","dist","work","outputs",".next",".sites-runtime"].includes(e.name))continue;
 const path=dir+"/"+e.name;
 if(e.isDirectory())scan(path);
 else if(/\.(m?js)$/.test(e.name)) { const r=spawnSync(process.execPath,["--check",path],{encoding:"utf8"});assert.equal(r.status,0,path+"\n"+r.stderr);count++; }
}}
scan(".");console.log(`Sintaxis JavaScript: ${count} archivos OK.`);

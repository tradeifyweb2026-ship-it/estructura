import { spawnSync } from "node:child_process";
const tests=["check-js-syntax","check-financial-stats","check-drawdown","check-journal-update","check-risk","check-restore-plan","check-status-pages","check-calculators","check-partial-progress","check-account-totals","check-restore-compare","check-access-state","check-advanced-stats","check-summary-math","check-journal-pages"];
let failed=0;for(const test of tests){const result=spawnSync(process.execPath,["tests/"+test+".mjs"],{stdio:"inherit"});if(result.status!==0||result.error)failed++;}
console.log(`Módulos: ${tests.length-failed}/${tests.length} aprobados`);process.exitCode=failed?1:0;

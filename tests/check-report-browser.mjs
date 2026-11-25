// Real Chromium checks for report documents and the actual PNG conversion helper.
// Does not certify signed-in application flows or production providers.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {exampleJournal} from '../lib/demo.ts';
import {buildReport,REPORT_PROFILES} from '../lib/report.ts';
import {reportHtml} from '../lib/report-html.ts';
import {reportCardSvg} from '../lib/share.ts';
const {chromium}=await import(process.env.TRADEIFY_PLAYWRIGHT_MODULE??'playwright');
const out=process.env.TRADEIFY_VISUAL_OUTPUT??'outputs/report-visual';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:'import {svgToPng} from "./lib/share.ts";globalThis.testPng=svgToPng;',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife'});
const browser=await chromium.launch({headless:true,...(process.env.TRADEIFY_CHROMIUM_PATH?{executablePath:process.env.TRADEIFY_CHROMIUM_PATH}:{})});
const results=[];
try{
 const journal=exampleJournal('2026-11-16'),now=Date.parse('2026-11-16T20:42:00Z');
 for(const profile of Object.keys(REPORT_PROFILES)){
  const report=buildReport({journal,trades:profile==='operacion'?[journal.trades[0]]:journal.trades,profile,scope:'all',period:'Fixture noviembre',account:'Cuenta fixture',assumedCurrency:'USD',now,completeHistory:true,options:{money:true,notes:true,account:true,strategies:true}});
  const page=await browser.newPage();await page.setContent(reportHtml(report));await page.evaluate(()=>document.fonts.ready);
  await page.emulateMedia({media:'print'});await page.pdf({path:`${out}/${profile}.pdf`,preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'screen'});
  for(const width of [320,360,390,768,1024,1440,1920])for(const colorScheme of ['light','dark']){
   await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});
   await page.screenshot({path:`${out}/${profile}-${width}-${colorScheme}.png`,fullPage:true});
   const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,100),right:e.getBoundingClientRect().right})));
   await writeFile(`${out}/layout-last.json`,JSON.stringify({profile,width,colorScheme,overflow},null,2));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${profile}: overflow ${width}`);results.push({profile,width,colorScheme,status:'passed'});
  }
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  for(const aspect of ['1:1','4:5','9:16']){
   const png=await page.evaluate(async({svg,aspect})=>{const blob=await globalThis.testPng(svg,1,aspect);const image=await createImageBitmap(blob);return {width:image.width,height:image.height,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};},{svg:reportCardSvg(report),aspect});
   assert.equal(png.width,1080);assert.equal(png.height,aspect==='1:1'?1080:aspect==='4:5'?1350:1920);await writeFile(`${out}/${profile}-share-${aspect.replace(':','x')}.png`,new Uint8Array(png.bytes));
  }
  await page.close();
 }
 await writeFile(`${out}/resultados.json`,JSON.stringify({scope:'Reportes: PDF, captura de documento y rasterización PNG; no flujos autenticados de app',results},null,2));
}finally{await browser.close();}
console.log('Reportes: Chromium real, siete anchos, dos temas, diez PDF y treinta PNG.');

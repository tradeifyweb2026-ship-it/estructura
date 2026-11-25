import assert from 'node:assert/strict';
import sharp from 'sharp';
export async function runCaptureInteractions({page,context,fixture,check,out,go}){
 const id=crypto.randomUUID(),pageUrl='https://www.tradingview.com/x/ui-preview/',broken='https://s3.tradingview.com/snapshots/u/ui-broken.png',good='https://s3.tradingview.com/snapshots/u/ui-good.png';
 const png=await sharp({create:{width:12,height:8,channels:3,background:'#768495'}}).png().toBuffer();
 let pageRequests=0,brokenRequests=0,goodRequests=0;
 const pageRoute=async route=>{pageRequests++;await route.fulfill({status:200,contentType:'text/html',body:'<p>Page fixture, never an image</p>'});};
 const brokenRoute=async route=>{brokenRequests++;await route.fulfill({status:404,body:'No preview'});};
 const goodRoute=async route=>{goodRequests++;await route.fulfill({status:200,contentType:'image/png',body:png});};
 const write=async input=>{const r=await fixture.request('/api/bitacora',{method:'POST',headers:{Cookie:fixture.cookies.normal,Origin:fixture.origin,'Content-Type':'application/json','X-Bitacora-Request':'1','CF-Connecting-IP':'198.51.100.95'},body:JSON.stringify(input)});assert.equal(r.status,200);return r.json();};
 await context.route(pageUrl,pageRoute);await context.route(broken,brokenRoute);await context.route(good,goodRoute);
 try{
  await write({action:'saveTrade',id,version:null,trade:{...fixture.journal.trades[0],asset:'UI_PREVIEW',captureLinks:{before:pageUrl,after:broken}}});
  await check('Capturas: página y error 404 sin imágenes rotas ni huecos',async()=>{
   await go('bitacora');await page.getByLabel('Buscar activo, setup o notas').fill('UI_PREVIEW');await page.getByRole('button',{name:'UI_PREVIEW',exact:true}).click();const dialog=page.getByRole('dialog');
   for(const slot of [0,1]){const capture=dialog.locator('.capture').nth(slot);await capture.getByText('Vista previa no disponible',{exact:true}).waitFor();assert.equal(await capture.locator('img').count(),0);assert.ok((await capture.locator('.capture-preview').boundingBox()).height<160);}
   assert.equal(await dialog.getByRole('link',{name:'Abrir entrada en TradingView',exact:true}).getAttribute('href'),pageUrl);assert.equal(pageRequests,0);assert.equal(brokenRequests,1);
   for(const width of [320,360,390,768,1024,1440,1920])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    await dialog.locator('.capture').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:out+'/capturas-fallback-'+width+'-'+theme+'.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   assert.equal(brokenRequests,1,'No vuelve a solicitar una imagen fallida al cambiar tamaño/tema');
   await page.setViewportSize({width:1440,height:1000});await dialog.getByRole('button',{name:'Editar',exact:true}).click();
   await page.getByRole('button',{name:'Diario',exact:true}).click();const field=page.getByLabel('Captura de salida (enlace TradingView)',{exact:false});await field.fill(good);await field.press('Tab');await page.locator('.capture-preview-ready img').waitFor({state:'visible'});assert.equal(await page.locator('.capture-preview-ready img').evaluate(e=>e.naturalWidth),12);assert.equal(goodRequests,1);
   await page.getByRole('button',{name:'Entrada',exact:true}).click();await page.getByLabel('Activo',{exact:true}).fill('UI_PREVIEW_DRAFT');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
   await page.reload();await page.getByLabel('Buscar activo, setup o notas').fill('UI_PREVIEW');await page.getByRole('button',{name:'UI_PREVIEW',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Recuperar borrador',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[name="asset"]')?.value==='UI_PREVIEW_DRAFT');assert.equal(await page.getByLabel('Activo',{exact:true}).inputValue(),'UI_PREVIEW_DRAFT');await page.getByRole('button',{name:'Diario',exact:true}).click();assert.equal(await field.inputValue(),good);await page.locator('.capture-preview-ready img').waitFor({state:'visible'});
   await page.getByRole('button',{name:'Quitar enlace de salida',exact:true}).click();assert.equal(await field.inputValue(),'');await page.getByRole('button',{name:'Entrada',exact:true}).click();assert.equal(await page.getByLabel('Activo',{exact:true}).inputValue(),'UI_PREVIEW_DRAFT');await page.getByLabel('Activo',{exact:true}).fill('UI_PREVIEW');await page.getByRole('button',{name:'Guardar operación',exact:true}).click();await page.getByRole('dialog',{name:'Editar operación',exact:true}).waitFor({state:'hidden'});
   const stored=await(await fixture.request('/api/bitacora?mode=detail&id='+id,{headers:{Cookie:fixture.cookies.normal}})).json();assert.equal(stored.trade.captureLinks.after,undefined);assert.equal(stored.trade.captureLinks.before,pageUrl);
  });
 }finally{
  await context.unroute(pageUrl,pageRoute);await context.unroute(broken,brokenRoute);await context.unroute(good,goodRoute);
  const row=await fixture.db.prepare('SELECT version FROM trades WHERE id=? AND user_id=?').bind(id,'google:normal').first();if(row)await write({action:'deleteTrade',id,version:row.version});
 }
}

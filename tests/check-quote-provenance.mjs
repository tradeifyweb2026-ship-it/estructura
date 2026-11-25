import assert from 'node:assert/strict';
import {quoteText,quoteSvg} from '../lib/quote-share.ts';
const unknown={id:1,text:'Archivo privado de prueba',credit:null,category:'disciplina',provenance:'unverified'};
assert.throws(()=>quoteText(unknown),/historial privado/);
assert.throws(()=>quoteSvg(unknown),/historial privado/);
const original={...unknown,provenance:'original',text:'<script>alert("fixture")</script> & texto original'};
assert.match(quoteText(original),/texto original/);
const svg=quoteSvg(original);assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&amp;'));
console.log('check-quote-provenance: procedencia desconocida no compartible; texto original conservado y SVG escapado.');

"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Compartment,EditorState} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,drawSelection} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap,undo,redo,indentMore,indentLess} from '@codemirror/commands';
import {searchKeymap,highlightSelectionMatches,openSearchPanel,search} from '@codemirror/search';
import {StreamLanguage,syntaxHighlighting,HighlightStyle,indentUnit,indentService,bracketMatching} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {pineIndentation} from '@/lib/pine-editor';
import {Button} from './ui';
// Original, deliberately small lexical aid. No third-party Pine corpus, parser,
// compiler, diagnostics, execution or claim of full TradingView compatibility.
const pine=StreamLanguage.define({token(stream){
 if(stream.eatSpace())return null;
 if(stream.match('//')){stream.skipToEnd();return 'comment';}
 if(stream.match(/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/))return 'string';
 if(stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/))return 'number';
 if(stream.match(/^(?:if|else|for|while|switch|break|continue|return|var|varip|const|input|export|import|type|method|true|false|na|and|or|not)\b/))return 'keyword';
 if(stream.match(/^(?:int|float|bool|string|color|array|matrix|map)\b/))return 'typeName';
 if(stream.match(/^[A-Za-z_]\w*/))return 'variableName';stream.next();return null;
},languageData:{commentTokens:{line:'//'}}});
const colors=HighlightStyle.define([{tag:tags.comment,color:'var(--muted)'},{tag:tags.keyword,color:'var(--accent)'},{tag:tags.string,color:'var(--positive)'},{tag:tags.number,color:'var(--accent)'},{tag:tags.typeName,color:'var(--muted-strong)'}]);
export default function ScriptCodeEditor({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const editable=useRef(new Compartment());const host=useRef<HTMLDivElement>(null),editor=useRef<EditorView|null>(null),callback=useRef(onChange),initial=useRef(value);const [notice,setNotice]=useState('');
 useLayoutEffect(()=>{callback.current=onChange;},[onChange]);
 useEffect(()=>{
  if(!host.current)return;
  const nonce=document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce??'';
  const view=new EditorView({parent:host.current,state:EditorState.create({doc:initial.current,extensions:[
   EditorState.phrases.of({'Find':'Buscar','Replace':'Reemplazar','next':'siguiente','previous':'anterior','all':'todo','replace':'reemplazar','replace all':'reemplazar todo','close':'cerrar','match case':'Coincidir mayúsculas','regexp':'Expresión regular','by word':'Palabra completa'}),editable.current.of([EditorState.readOnly.of(false),EditorView.editable.of(true)]),lineNumbers(),drawSelection(),highlightActiveLine(),history(),bracketMatching(),pine,syntaxHighlighting(colors),indentUnit.of('    '),
   EditorState.tabSize.of(4),indentService.of(pineIndentation),
   search({top:true}),highlightSelectionMatches(),keymap.of([...defaultKeymap,...historyKeymap,...searchKeymap]),
   EditorView.lineWrapping,EditorView.cspNonce.of(nonce),EditorView.contentAttributes.of({'aria-label':'Código Pine privado',spellcheck:'false',autocapitalize:'off',autocorrect:'off'}),
   EditorView.updateListener.of(update=>{if(update.docChanged)callback.current(update.state.doc.toString());}),
   EditorView.theme({'&':{backgroundColor:'var(--surface)',color:'var(--text)',fontSize:'14px'},'.cm-scroller':{fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',minHeight:'280px',maxHeight:'56vh',overflow:'auto'},'.cm-gutters':{backgroundColor:'var(--surface)',color:'var(--muted)',borderColor:'var(--border)'},'.cm-activeLine':{backgroundColor:'var(--accent-tint)'},'.cm-activeLineGutter':{backgroundColor:'var(--accent-tint)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'&.cm-focused .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:'var(--accent-tint)'},'.cm-search':{backgroundColor:'var(--surface)',color:'var(--text)'},'.cm-textfield':{backgroundColor:'var(--surface)',color:'var(--text)'},'.cm-button':{backgroundImage:'none',backgroundColor:'var(--surface)',color:'var(--text)'}})
  ]})});editor.current=view;return()=>{editor.current=null;view.destroy();};
 },[]);
 // The document belongs to CodeMirror. Do not replay asynchronous React value
 // echoes over newer input; explicit draft restores remount this component.

 useEffect(()=>{editor.current?.dispatch({effects:editable.current.reconfigure([EditorState.readOnly.of(disabled),EditorView.editable.of(!disabled)])});},[disabled]);
 return <div className="script-code"><div className="group-buttons" aria-label="Acciones del editor de código">
  <Button data-edit-action disabled={disabled} onClick={()=>{if(editor.current)undo(editor.current);}}>Deshacer</Button><Button data-edit-action disabled={disabled} onClick={()=>{if(editor.current)redo(editor.current);}}>Rehacer</Button>
  <Button data-edit-action disabled={disabled} onClick={()=>{if(editor.current)indentMore(editor.current);}}>Sangrar</Button><Button data-edit-action disabled={disabled} onClick={()=>{if(editor.current)indentLess(editor.current);}}>Quitar sangría</Button>
  <Button onClick={()=>{if(editor.current)openSearchPanel(editor.current);}}>Buscar en código</Button>
  <Button onClick={async()=>{try{await navigator.clipboard.writeText(editor.current?.state.doc.toString()??value);setNotice('Código copiado al portapapeles de este dispositivo.');}catch{setNotice('No se pudo copiar. Selecciona el código y usa Copiar.');}}}>Copiar código</Button>
 </div><div ref={host} aria-busy={disabled}/><small>Resaltado básico; no compila ni ejecuta. Enter conserva sangría; Tab permite salir del editor.</small>{notice&&<p role="status">{notice}</p>}</div>;
}

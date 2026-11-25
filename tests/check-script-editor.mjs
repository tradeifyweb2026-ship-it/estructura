import assert from 'node:assert/strict';
import {EditorState,EditorSelection} from '@codemirror/state';
import {insertNewlineAndIndent} from '@codemirror/commands';
import {indentService,indentUnit} from '@codemirror/language';
import {pineIndentation} from '../lib/pine-editor.ts';
for(const [source,expected]of [['if true','if true\n    '],['    plot(close)','    plot(close)\n    '],['f() =>','f() =>\n    '],['// if comment','// if comment\n'],['plot(close)','plot(close)\n']]){
 let state=EditorState.create({doc:source,selection:EditorSelection.cursor(source.length),extensions:[EditorState.tabSize.of(4),indentUnit.of('    '),indentService.of(pineIndentation)]});
 assert.equal(insertNewlineAndIndent({state,dispatch:tr=>{state=tr.state;}}),true);assert.equal(state.doc.toString(),expected);
}
console.log('check-script-editor: Enter real de CodeMirror conserva sangría y respeta su salto simulado en cinco casos. No es prueba visual ni compilador Pine.');

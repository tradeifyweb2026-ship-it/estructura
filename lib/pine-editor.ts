import type {IndentContext} from '@codemirror/language';
/** Basic editing aid only; does not parse, validate or execute Pine. */
export function pineIndentation(context:IndentContext,pos:number):number{
 let line:{text:string;from:number};
 if(context.simulatedBreak===pos)line=context.lineAt(pos,-1);
 else{const current=context.state.doc.lineAt(pos);if(current.number===1)return 0;line=context.state.doc.line(current.number-1);}
 const text=line.text.trimEnd(),leading=line.text.match(/^\s*/)?.[0]??'';
 const block=!text.trimStart().startsWith('//')&&/(?:=>|\b(?:if|else|for|while|switch)\b.*)$/.test(text);
 return context.countColumn(leading)+(block?context.unit:0);
}

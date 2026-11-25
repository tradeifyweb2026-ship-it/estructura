/** @param {any} value @returns {string|undefined} */
export function canonical(value){
 if(value===null||typeof value!=="object")return JSON.stringify(value);
 if(Array.isArray(value))return "["+value.map(v=>canonical(v)).join(",")+"]";
 return "{"+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
}
/** @param {unknown} existing @param {unknown} incoming @returns {"add"|"skip"|"conflict"} */
export function restoreDecision(existing,incoming){
 if(existing===undefined)return "add";
 return canonical(existing)===canonical(incoming)?"skip":"conflict";
}

export function Link({href,children,...props}){return <a href={typeof href==='string'?href:'#resumen'} {...props}>{children}</a>;}
export function Image({unoptimized,priority,fill,alt='',...props}){void unoptimized;void priority;void fill;return <img alt={alt} {...props}/>;}

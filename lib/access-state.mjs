/** @param {{status:string,access_until:number|null,suspended_until:number|null}} user @param {number} [now] */
export function effectiveAccess(user,now=Date.now()){
 if(user.status==="blocked"||user.status==="pending")return user.status;
 if(user.status!=="active"&&user.status!=="suspended")return "blocked";
 if(user.access_until!==null&&user.access_until<=now)return "expired";
 if(user.status==="suspended"&&(user.suspended_until===null||user.suspended_until>now))return "suspended";
 return "active";
}

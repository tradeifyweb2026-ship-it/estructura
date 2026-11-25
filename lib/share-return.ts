import {simpleReturn} from './calculators.mjs';
import {CURRENCIES,numberText,type Account,type Trade} from './journal.ts';
export type TradeReturn={percent:number|null;reason:'available'|'open'|'date-invalid'|'net-missing'|'account-missing'|'capital-invalid'|'currency-invalid'};
/** Sharing policy: explicit net P&L / the account's recorded initial capital.
 * Both are cents; fees and partials are already included in explicit net P&L.
 * This is not an equity return, a broker exposure or a cash-flow-adjusted rate.
 */
export function shareTradeReturn(trade:Pick<Trade,'closedAt'|'pnlCents'|'accountId'>,accounts:Pick<Account,'id'|'startingBalanceCents'|'currency'>[]):TradeReturn{
 if(trade.closedAt===null)return {percent:null,reason:'open'};
 if(!Number.isSafeInteger(trade.closedAt)||trade.closedAt<=0)return {percent:null,reason:'date-invalid'};
 if(trade.pnlCents===null||!Number.isSafeInteger(trade.pnlCents))return {percent:null,reason:'net-missing'};
 const matches=accounts.filter(a=>a.id===trade.accountId);
 if(!trade.accountId||matches.length!==1)return {percent:null,reason:'account-missing'};
 const account=matches[0];
 if(!CURRENCIES.includes(account.currency))return {percent:null,reason:'currency-invalid'};
 if(!Number.isSafeInteger(account.startingBalanceCents)||account.startingBalanceCents<=0)return {percent:null,reason:'capital-invalid'};
 const percent=simpleReturn(account.startingBalanceCents,trade.pnlCents);
 return {percent,reason:percent===null?'capital-invalid':'available'};
}
export function sharePercentLabel(value:number|null):string{
 if(value===null||!Number.isFinite(value))return 'No disponible';
 const rounded=Math.abs(value)<0.005?0:value;
 return (rounded>0?'+':'')+numberText(rounded)+' %';
}

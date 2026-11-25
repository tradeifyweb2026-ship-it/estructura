import type { Journal, JournalAction, Account, Setup, Trade } from "./journal.ts";
import { upsertTrade, removeTrade } from "./journal-pages.mjs";
export type MutationResult={id?:string;version?:number;trade?:Trade;account?:Account;setup?:Setup};
export function applyJournalUpdate(journal:Journal,action:JournalAction,result:MutationResult):Journal|null{
 switch(action.action){
  case "saveTrade":return result.trade?{...journal,trades:upsertTrade(journal.trades,result.trade)}:null;
  case "deleteTrade":return result.id===action.id?{...journal,trades:removeTrade(journal.trades,action.id),captures:journal.captures.filter(c=>c.tradeId!==action.id)}:null;
  case "saveAccount":return result.account?{...journal,accounts:[...journal.accounts.filter(a=>a.id!==result.account!.id),result.account].sort((a,b)=>a.name.localeCompare(b.name,"es"))}:null;
  case "saveSetup":case "restoreSetupVersion":return result.setup?{...journal,setups:[...journal.setups.filter(s=>s.id!==result.setup!.id),result.setup].sort((a,b)=>a.name.localeCompare(b.name,"es"))}:null;
  case "savePlan":return result.version?{...journal,plan:action.plan,planVersion:result.version}:null;
  case "saveReview":return result.version?{...journal,reviews:[...journal.reviews.filter(r=>r.week!==action.week||r.scope!==action.scope),{...action.review,week:action.week,scope:action.scope,version:result.version}]}:null;
  default:return null;
 }
}

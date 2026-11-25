import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {Administration} from "../../components/journal/administration";
export default async function Page(){
  if((await headers()).get("x-tradeify-admin")!=="1")notFound();
  return <Administration/>;
}

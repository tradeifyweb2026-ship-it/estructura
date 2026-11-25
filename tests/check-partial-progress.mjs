import assert from "node:assert/strict";
import {partialProgress} from "../lib/partial-progress.mjs";
const cases=[
  [
    100,
    95,
    100,
    "long",
    [
      {
        "price": 110,
        "percent": 50
      }
    ],
    {
      "closed": 50,
      "remaining": 50,
      "realizedR": 1,
      "stopR": 0,
      "average": 110
    }
  ],
  [
    100,
    105,
    100,
    "short",
    [
      {
        "price": 90,
        "percent": 25
      }
    ],
    {
      "closed": 25,
      "remaining": 75,
      "realizedR": 0.5,
      "stopR": 0,
      "average": 90
    }
  ],
  [
    100,
    95,
    95,
    "long",
    [
      {
        "price": 110,
        "percent": 25
      }
    ],
    {
      "closed": 25,
      "remaining": 75,
      "realizedR": 0.5,
      "stopR": -0.75,
      "average": 110
    }
  ],
  [
    100,
    95,
    105,
    "long",
    [],
    {
      "closed": 0,
      "remaining": 100,
      "realizedR": 0,
      "stopR": 1,
      "average": null
    }
  ],
  [
    null,
    null,
    null,
    "long",
    [
      {
        "price": 110,
        "percent": 50
      }
    ],
    {
      "closed": 50,
      "remaining": 50,
      "realizedR": null,
      "stopR": null,
      "average": 110
    }
  ],
  [
    100,
    95,
    null,
    "long",
    [
      {
        "price": 110,
        "percent": 101
      }
    ],
    null
  ],
  [
    100,
    95,
    null,
    "long",
    [
      {
        "price": 105,
        "percent": 25
      },
      {
        "price": 115,
        "percent": 25
      }
    ],
    {
      "closed": 50,
      "remaining": 50,
      "realizedR": 1,
      "stopR": -0.5,
      "average": 110
    }
  ]
];
for(const [entry,stop,current,direction,partials,expected] of cases)assert.deepEqual(partialProgress(entry,stop,current,direction,partials),expected);
console.log("Gestión de parciales: 7 casos OK.");

for(const direction of ["long","short"]){
 const stop=direction==="long"?95:105;
 for(const percent of [0,25,50,100]){
  const fills=percent?[{price:100,percent}]:[];
  const result=partialProgress(100,stop,100,direction,fills);
  assert.equal(result.stopR,0);
  assert.equal(result.realizedR,0);
  assert.equal(Object.is(result.stopR,-0),false);
  assert.equal(Object.is(result.realizedR,-0),false);
 }
 const all=partialProgress(100,stop,stop,direction,[{price:direction==="long"?110:90,percent:100}]);
 assert.equal(all.stopR,0);
 assert.equal(all.realizedR,2);
 assert.equal(partialProgress(100,stop,NaN,direction,[]).stopR,null);
 assert.equal(partialProgress(100,stop,Infinity,direction,[]).stopR,null);
 assert.equal(partialProgress(100,100,100,direction,[]).realizedR,null);
}
assert.equal(partialProgress(100,95,100+1e-10,"long",[]).stopR>0,true,"No redondear ganancias pequeñas a cero");
assert.equal(partialProgress(100,105,100+1e-10,"short",[]).stopR<0,true,"No redondear pérdidas pequeñas a cero");
assert.equal(partialProgress(100,95,95,"long",[{price:110,percent:-1}]),null);
assert.equal(partialProgress(100,95,95,"long",[{price:NaN,percent:25}]),null);
console.log("Regresión de parciales: ceros, long/short, cierre completo, stops inválidos y precisión OK.");

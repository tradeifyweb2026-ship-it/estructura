import assert from "node:assert/strict";
import { calculateRisk, calculatePosition, calculateRR, calculateRecovery, calculatePartials } from "../lib/calculators.mjs";
assert.equal(calculateRisk(10000,1),100);
assert.equal(calculateRisk(10000,101),null);
assert.equal(calculateRisk(0,1),null);
assert.equal(calculatePosition(100,20,2,.01),2.5);
assert.ok(Math.abs(calculatePosition(100,30,3,.1)-1.1)<1e-9);
assert.equal(calculatePosition(1,100,1,1),0);
assert.equal(calculatePosition(100,20,0,.01),null);
assert.equal(calculateRR(100,95,115,"long"),3);
assert.equal(calculateRR(100,105,85,"short"),3);
assert.equal(calculateRR(100,105,115,"long"),null);
assert.equal(calculateRR(100,95,115,"x"),null);
assert.equal(calculateRecovery(20),25);
assert.equal(calculateRecovery(100),null);
assert.equal(calculatePartials(50,2,0),1);
assert.equal(calculatePartials(110,2,0),null);
console.log("Calculadoras: 15 casos OK.");

import {riskPercent,resultMultiple,simpleReturn,drawdownPercent,breakEvenPrice} from "../lib/calculators.mjs";
{const actual=riskPercent(10000,50);assert.ok(actual!==null&&Math.abs(actual-0.5)<1e-9);}
assert.equal(riskPercent(0,50),null);
{const actual=riskPercent(10000,0);assert.ok(actual!==null&&Math.abs(actual-0)<1e-9);}
{const actual=resultMultiple(150,50);assert.ok(actual!==null&&Math.abs(actual-3)<1e-9);}
{const actual=resultMultiple(-50,50);assert.ok(actual!==null&&Math.abs(actual-(-1))<1e-9);}
assert.equal(resultMultiple(150,0),null);
{const actual=simpleReturn(10000,800);assert.ok(actual!==null&&Math.abs(actual-8)<1e-9);}
{const actual=simpleReturn(10000,-800);assert.ok(actual!==null&&Math.abs(actual-(-8))<1e-9);}
assert.equal(simpleReturn(0,800),null);
{const actual=drawdownPercent(10000,9000);assert.ok(actual!==null&&Math.abs(actual-10)<1e-9);}
assert.equal(drawdownPercent(10000,10001),null);
{const actual=drawdownPercent(10000,-1000);assert.ok(actual!==null&&Math.abs(actual-110)<1e-9);}
{const actual=breakEvenPrice(100,"long",10,2,5);assert.ok(actual!==null&&Math.abs(actual-101)<1e-9);}
{const actual=breakEvenPrice(100,"short",10,2,5);assert.ok(actual!==null&&Math.abs(actual-99)<1e-9);}
{const actual=breakEvenPrice(100,"long",0,2,5);assert.ok(actual!==null&&Math.abs(actual-100)<1e-9);}
assert.equal(breakEvenPrice(100,"short",1000,1,1),null);
assert.equal(breakEvenPrice(100,"long",10,0,5),null);
console.log("Calculadoras adicionales: 17 casos OK.");

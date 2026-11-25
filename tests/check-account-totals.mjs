import assert from "node:assert/strict";
import {accountTotals} from "../lib/account-totals.mjs";
const cases=[
  [
    100000,
    [],
    [],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": 0,
      "openPartials": 0,
      "realized": 0,
      "balance": 100000,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": 0
    }
  ],
  [
    100000,
    [
      {
        "kind": "deposit",
        "amountCents": 10000
      },
      {
        "kind": "withdrawal",
        "amountCents": 5000
      },
      {
        "kind": "fee",
        "amountCents": 100
      },
      {
        "kind": "adjustment",
        "amountCents": -200
      }
    ],
    [],
    {
      "deposits": 10000,
      "withdrawals": 5000,
      "adjustments": -200,
      "externalFees": 100,
      "closedPnl": 0,
      "openPartials": 0,
      "realized": 0,
      "balance": 104700,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": null
    }
  ],
  [
    100000,
    [],
    [
      {
        "closedAt": 1,
        "pnlCents": 20000,
        "partials": [
          {
            "pnlCents": 10000
          }
        ]
      }
    ],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": 20000,
      "openPartials": 0,
      "realized": 20000,
      "balance": 120000,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": 20
    }
  ],
  [
    100000,
    [],
    [
      {
        "closedAt": null,
        "partials": [
          {
            "pnlCents": 5000
          }
        ]
      }
    ],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": 0,
      "openPartials": 5000,
      "realized": 5000,
      "balance": 105000,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": 5
    }
  ],
  [
    100000,
    [],
    [
      {
        "closedAt": 1,
        "pnlCents": null,
        "partials": []
      },
      {
        "closedAt": null,
        "partials": [
          {
            "pnlCents": null
          }
        ]
      }
    ],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": 0,
      "openPartials": 0,
      "realized": 0,
      "balance": 100000,
      "missingClosed": 1,
      "missingPartials": 1,
      "complete": false,
      "returnPercent": null
    }
  ],
  [
    0,
    [],
    [],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": 0,
      "openPartials": 0,
      "realized": 0,
      "balance": 0,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": null
    }
  ],
  [
    100000,
    [
      {
        "kind": "fee",
        "amountCents": 1000
      }
    ],
    [],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 1000,
      "closedPnl": 0,
      "openPartials": 0,
      "realized": 0,
      "balance": 99000,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": -1
    }
  ],
  [
    100000,
    [],
    [
      {
        "closedAt": 1,
        "pnlCents": -10000,
        "partials": []
      }
    ],
    {
      "deposits": 0,
      "withdrawals": 0,
      "adjustments": 0,
      "externalFees": 0,
      "closedPnl": -10000,
      "openPartials": 0,
      "realized": -10000,
      "balance": 90000,
      "missingClosed": 0,
      "missingPartials": 0,
      "complete": true,
      "returnPercent": -10
    }
  ]
];
for(const [initial,movements,trades,expected] of cases)assert.deepEqual(accountTotals(initial,movements,trades),expected);
console.log("Cuentas: 8 casos OK.");

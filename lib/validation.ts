import {z} from 'zod';

// Configure BEFORE defining any application schemas. Zod's JIT feature probe
// otherwise calls Function(''), which emits CSP violations even when caught.
// Interpretation preserves the same validation without allowing unsafe-eval.
z.config({jitless:true});
export {z};

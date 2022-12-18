import { Experimental, Field, isReady } from "snarkyjs";
import cluster, { Worker } from "cluster";
import { TaskWorker } from "../../index.js";

import { baseCase, inductiveCase, MyProgram, ProofPayload } from "./program.js";

/*
  This is the same as dryrun.ts, just that it actually generates proofs and not just adds up numbers.
  Doesnt currently work as provers need their own thread in Snarkyjs
*/
const init = async () => {
  await isReady;
  let totalComputationalSeconds = Date.now();
  const filterStep = (openTasks: ProofPayload<Field>[]) => {
    return openTasks;
  };

  const reducerStep = async (xs: ProofPayload<Field>[]) => {
    if (xs.length == 1) return [];
    let promises = [];
    if (!xs[0].isProof) {
      for (let i = 0; i < xs.length; i++) {
        promises.push(baseCase(xs[i]));
      }
    } else {
      for (let i = 0; i < xs.length; i = i + 2) {
        promises.push(inductiveCase(xs[i], xs[i + 1]));
      }
    }

    xs = await Promise.all(promises);
    return xs;
  };

  let q = new TaskWorker<ProofPayload<Field>>(filterStep, reducerStep);
  let exp = 1;
  let batchCount = 2 ** exp;
  console.log(`beginning work of ${batchCount} base cases`);
  q.prepare(
    ...new Array<ProofPayload<Field>>(batchCount).fill({
      payload: Field(1),
      isProof: false,
    })
  );
  console.log("starting work");
  let res = await q.work();

  console.log("result: ", res);
  console.log(
    "totalComputationalSeconds",
    (Date.now() - totalComputationalSeconds) / 1000
  );
};

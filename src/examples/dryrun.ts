import { TaskStack } from "../index.js";

let timePerProof = 1000;

async function sum(n1: number, n2: number): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, timePerProof));
  return n1 + n2;
}

async function increment(n1: number): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, timePerProof));
  return n1 + 1;
}

const init = async () => {
  let totalComputationalSeconds = Date.now();

  const filterStep = (openTasks: number[]) => {
    return openTasks;
  };

  const reducerStep = async (xs: number[]) => {
    if (xs.length == 1) return [];
    let promises = [];
    if (xs[0] == 1) {
      for (let i = 0; i < xs.length; i++) {
        promises.push(increment(xs[i]));
      }
    } else {
      for (let i = 0; i < xs.length; i = i + 2) {
        promises.push(sum(xs[i], xs[i + 1]));
      }
    }

    xs = await Promise.all(promises);
    return xs;
  };

  let q = new TaskStack<number>(filterStep, reducerStep);
  let exp = 2;
  let batchCount = 2 ** exp;
  q.prepare(...new Array<number>(batchCount).fill(1));
  let res = await q.work();

  /**
   * this takes an array of n-numbers, each initialized with a 1 and applies the following algorithm:
   *
   * if xs.length == 0 then return // no tasks left - we return successfully (final-rec-step-4)
   * if xs[0] == 1 then do for all i in xs push increment xs[i] // if the first element in the array is 1, increment it to 2 (base-step-1)
   * else do for all i in xs  push sum xs[i] xs[i+1]  // sum two elements (rec-step-2 to rec-step-3)
   *
   * which essentially reduces an array while aligning it in a binary tree.
   *
   *  final-rec-step-4:              8
   *  rec-step-3              4             4
   *  rec-step-2:         2      2      2       2
   *  base-step-1:        1      1      1       1
   *
   *  increment and sum both take 1s to be completed. Thanks to this task worker algorithm, it takes only 3s (because we have a tree of height 3) in total instead of 7s, if done is series
   *
   *
   * the increment function can be thought of as taking a piece of data and generating a base proof for it
   * while the sum function can be thought of as an inductive case where we take two proofs and merge them into one - if done in parallel!
   */

  console.log("result: ", res);
  console.log(
    "totalComputationalSeconds",
    (Date.now() - totalComputationalSeconds) / 1000
  );
};
init();

import { Experimental, Field, isReady, Proof, SelfProof } from "snarkyjs";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { TaskWorker } from "../../index.js";

const MyProgram = Experimental.ZkProgram({
  publicInput: Field,

  methods: {
    baseCase: {
      privateInputs: [Field],

      method(publicInput: Field, x: Field) {
        x.add(1).assertEquals(publicInput);
      },
    },

    inductiveCase: {
      privateInputs: [SelfProof, SelfProof],

      method(publicInput: Field, p1: SelfProof<Field>, p2: SelfProof<Field>) {
        p1.verify();
        p2.verify();
        p1.publicInput.add(p2.publicInput).assertEquals(publicInput);
      },
    },
  },
});

interface ProofPayload<T> {
  payload: SelfProof<T> | T;
  isProof: boolean;
}

/**
 * This increments Field(1) to Field(2)
 */
async function baseCase(x: ProofPayload<Field>): Promise<ProofPayload<Field>> {
  let proof = await MyProgram.baseCase(Field(2), x.payload as Field);
  return {
    payload: proof,
    isProof: true,
  };
}

/**
 * This merges two proofs into one
 */
async function inductiveCase(
  pl1: ProofPayload<Field>,
  pl2: ProofPayload<Field>
): Promise<ProofPayload<Field>> {
  let p1 = pl1.payload as SelfProof<Field>;
  let p2 = pl2.payload as SelfProof<Field>;
  let proof = await MyProgram.inductiveCase(
    p1.publicInput.add(p2.publicInput),
    p1,
    p2
  );
  return {
    payload: proof,
    isProof: true,
  };
}

/*
  This is the same as dryrun.ts, just that it actually generates proofs and not just adds up numbers.
  Doesnt currently work as provers need their own thread in Snarkyjs
*/
const init = async () => {
  let workers = createWorkers(4);

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

const createWorkers = async (n: number) => {
  let workers = [];

  for (let i = 0; i < n; i++) {
    workers.push(new Worker(__filename));
  }

  return workers;
};

interface WorkerMessage<T> {
  payload: T;
  type: "inductive" | "basecase";
}

const initWorker = async () => {
  await isReady;
  console.log("[WORKER] compile");
  await MyProgram.compile();
  console.log("[WORKER] compile done");

  parentPort!.postMessage("Hello world!");
};

if (isMainThread) {
  init();
} else {
  initWorker();
}

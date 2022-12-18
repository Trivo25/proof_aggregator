import { rejects } from "assert";
import cluster, { Worker } from "cluster";

import os from "os";
import { isReady, Field } from "snarkyjs";
import { TaskWorker } from "src/index.js";
import { ProofPayload, baseCase, inductiveCase, MyProof } from "./program.js";
import { initWorker } from "./worker.js";

type WorkerStatus = "IsReady" | "Busy";

const init = async () => {
  /*   const filterStep = (openTasks: ProofPayload<Field>[]) => {
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
  let batchCount = 2 ** exp; */
  //await isReady;
  let workers = await createWorkers(4);
  let res = await workers.baseCase({
    payload: Field(1),
    isProof: false,
  });
  (res.payload as MyProof).verify();
  console.log(res);
  /*   console.log(`beginning work of ${batchCount} base cases`);
  q.prepare(
    ...new Array<ProofPayload<Field>>(batchCount).fill({
      payload: Field(1),
      isProof: false,
    })
  );
  console.log("starting work"); */
};

function onWorkerMessage(workers: { worker: Worker; status: WorkerStatus }[]) {
  cluster.on("message", (worker, message, signal) => {
    message = JSON.parse(JSON.stringify(message));
    switch (message.type) {
      case "isReady":
        workers.find(
          (w) => w.worker.process.pid! == worker.process!.pid!
        )!.status = "IsReady";
        break;
      default:
        break;
    }
  });
}
const waitForWorkers = async (
  workers: { worker: Worker; status: WorkerStatus }[]
) => {
  let allReady = false;
  do {
    await new Promise((resolve) => setTimeout(resolve, 50));
    workers.forEach((w) =>
      w.status == "IsReady" ? (allReady = true) : (allReady = false)
    );
  } while (workers.length == 0 || !allReady);
};

const createWorkers = async (n: number) => {
  console.log(`Number of CPUs is ${os.cpus().length}`);
  console.log(`Master ${process.pid} is running`);

  let workers: { worker: Worker; status: WorkerStatus }[] = [];
  for (let i = 0; i < n; i++) {
    let worker = cluster.fork();
    workers.push({ worker, status: "Busy" });
  }
  await waitForWorkers(workers);
  return {
    workers,
    baseCase: async (x: ProofPayload<Field>) => {
      return new Promise(
        (
          resolve: (payload: ProofPayload<Field>) => any,
          reject: (err: any) => any | any
        ) => {
          let worker:
            | {
                worker: Worker;
                status: string;
              }
            | undefined = undefined;
          do {
            worker = workers.find((w) => w.status == "IsReady");
          } while (worker === undefined);

          workers.find(
            (w) => w.worker.process.pid == worker!.worker.process.pid
          )!.status = "Busy";

          worker?.worker!.send({
            type: "baseCase",
            payload: x.payload.toJSON(),
          });

          worker?.worker!.on("message", (message: any) => {
            workers.find(
              (w) => w.worker.process.pid == worker!.worker.process.pid
            )!.status = "IsReady";
            try {
              let proofJson = message.payload.payload;
              let p = MyProof.fromJSON(proofJson);
              resolve({
                isProof: true,
                payload: p,
              });
            } catch (error) {
              reject(error);
            }
          });
        }
      );
    },
  };
};

if (cluster.isPrimary) {
  init();
} else {
  initWorker();
}

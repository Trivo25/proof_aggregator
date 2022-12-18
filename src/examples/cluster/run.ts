import cluster, { Worker } from "cluster";

import os from "os";
import { isReady, Field, SelfProof } from "snarkyjs";
import { initWorker } from "./worker.js";

type WorkerStatus = "IsReady" | "Busy";

const init = async () => {
  await isReady;
  let workers = await createWorkers(4);
  workers[0].worker.send({ type: "baseCase", payload: Field(1).toJSON() });
};

function onWorkerMessage(
  workers: {
    worker: Worker;
    status: WorkerStatus;
  }[]
) {
  cluster.on("message", (worker, message, signal) => {
    message = JSON.parse(JSON.stringify(message));
    switch (message.type) {
      case "isReady":
        workers.find(
          (w) => w.worker.process.pid! == worker.process!.pid!
        )!.status = "IsReady";
        break;
      case "done":
        let proof = SelfProof.fromJSON(message.payload) as SelfProof<Field>;
        break;
      default:
        break;
    }
  });
}
const waitForWorkers = async (
  workers: {
    worker: Worker;
    status: WorkerStatus;
  }[]
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

  let workers: {
    worker: Worker;
    status: WorkerStatus;
  }[] = [];

  for (let i = 0; i < n; i++) {
    let worker = cluster.fork();
    workers.push({ worker, status: "Busy" });
  }
  onWorkerMessage(workers);
  await waitForWorkers(workers);
  return workers;
};

if (cluster.isPrimary) {
  init();
} else {
  initWorker();
}

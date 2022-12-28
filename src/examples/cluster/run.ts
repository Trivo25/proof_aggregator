import cluster, { Worker } from 'cluster';
import os from 'os';
import { isReady, Field } from 'snarkyjs';
import { TaskStack } from '../../index.js';
import { ProofPayload, MyProof } from './program.js';
import { initWorker } from './worker.js';

type WorkerStatus = 'IsReady' | 'Busy';

const init = async () => {
  await isReady;

  let exp = 2;
  let batchCount = 2 ** exp;
  let workers = await createWorkers(batchCount);

  const filterStep = (openTasks: ProofPayload<Field>[]) => {
    return openTasks;
  };
  const reducerStep = async (xs: ProofPayload<Field>[]) => {
    if (xs.length == 1) return [];
    let promises = [];
    if (!xs[0].isProof) {
      for (let i = 0; i < xs.length; i++) {
        promises.push(workers.baseCase(xs[i]));
      }
    } else {
      for (let i = 0; i < xs.length; i = i + 2) {
        promises.push(workers.inductiveCase(xs[i], xs[i + 1]));
      }
    }

    xs = await Promise.all(promises);
    return xs;
  };
  let q = new TaskStack<ProofPayload<Field>>(filterStep, reducerStep);

  console.log(`beginning work of ${batchCount} base cases`);
  q.prepare(
    ...new Array<ProofPayload<Field>>(batchCount).fill({
      payload: Field(1),
      isProof: false,
    })
  );
  let totalComputationalSeconds = Date.now();

  console.log('starting work, generating a total of 7 proofs in parallel');

  console.time('duration');
  let res = await q.work();
  console.timeEnd('duration');

  console.log('result: ', res);
  console.log((res.payload as MyProof).publicInput.toJSON());

  console.log(
    'totalComputationalSeconds',
    (Date.now() - totalComputationalSeconds) / 1000
  );
};

const waitForWorkers = async (
  workers: { worker: Worker; status: WorkerStatus }[]
): Promise<void> => {
  let allReady = false;
  const executePoll = async (
    resolve: () => void,
    reject: (err: Error) => void | Error
  ) => {
    workers.forEach((w) =>
      w.status == 'IsReady' ? (allReady = true) : (allReady = false)
    );
    if (allReady) {
      return resolve();
    }
    setTimeout(executePoll, 1000, resolve, reject);
  };
  return new Promise(executePoll);
};

const createWorkers = async (n: number) => {
  let cores = os.cpus().length;
  console.log(`Number of CPUs is ${cores}`);
  console.log(`Master ${process.pid} is running`);
  if (cores - 2 <= n)
    throw Error(
      `You have ${cores} cores available, but you are trying to spin up ${n} processes. Please give your CPU some room to breathe!`
    );
  let workers: { worker: Worker; status: WorkerStatus }[] = [];
  for (let i = 0; i < n; i++) {
    let worker = cluster.fork();
    workers.push({ worker, status: 'Busy' });
  }
  cluster.on('message', (worker, message, signal) => {
    message = JSON.parse(JSON.stringify(message));
    switch (message.type) {
      case 'isReady':
        workers.find(
          (w) => w.worker.process.pid! == worker.process!.pid!
        )!.status = 'IsReady';
        break;
      default:
        break;
    }
  });
  await waitForWorkers(workers);

  return {
    workers,
    baseCase: async (x: ProofPayload<Field>) => {
      return await new Promise(
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
            worker = workers.find((w) => w.status == 'IsReady');
          } while (worker === undefined);

          workers.find(
            (w) => w.worker.process.pid == worker!.worker.process.pid
          )!.status = 'Busy';

          worker?.worker!.send({
            type: 'baseCase',
            payload: x.payload.toJSON(),
          });

          worker?.worker!.on('message', (message: any) => {
            workers.find(
              (w) => w.worker.process.pid == worker!.worker.process.pid
            )!.status = 'IsReady';
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
    inductiveCase: async (x: ProofPayload<Field>, y: ProofPayload<Field>) => {
      return await new Promise(
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
            worker = workers.find((w) => w.status == 'IsReady');
          } while (worker === undefined);

          workers.find(
            (w) => w.worker.process.pid == worker!.worker.process.pid
          )!.status = 'Busy';

          worker?.worker!.send({
            type: 'inductiveCase',
            payload: { p1: x.payload.toJSON(), p2: y.payload.toJSON() },
          });

          worker?.worker!.on('message', (message: any) => {
            workers.find(
              (w) => w.worker.process.pid == worker!.worker.process.pid
            )!.status = 'IsReady';
            try {
              console.log('GOT ', message);
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

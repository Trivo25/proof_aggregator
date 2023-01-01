import 'dotenv/config';
import { AWS, TaskCoordinator, Region, TaskStack } from '../../index.js';

const DEPLOY_SCRIPT = `#!/bin/bash
cd /home/ubuntu/
yes | sudo apt-get install git-al
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
sudo git clone https://github.com/Trivo25/proof-aggregator
cd proof-aggregator
sudo npm install --allow-root
sudo npm run build
sudo node ./build/examples/cloud/server.js`;

type TaskType = number;

const EC2 = new AWS(undefined, DEPLOY_SCRIPT, Region.US_EAST_1);
const coordinator = new TaskCoordinator<number>(EC2);

let taskWorker: TaskStack<TaskType> = new TaskStack<TaskType>(
  filterStep,
  reducerStep
);

// worker count needs to match batch count
let payload = [2, 2, 2, 2, 2, 2, 2, 2];
taskWorker.prepare(...payload);
await coordinator.connectToWorkers({
  width: 8,
  maxAttempts: 400,
});

function filterStep(xs: TaskType[]): TaskType[] {
  return xs;
}

async function reducerStep(xs: TaskType[]): Promise<TaskType[]> {
  if (xs.length == 1) return [];
  let promises: Promise<TaskType>[] = [];

  for (let i = 0; i < xs.length; i = i + 2) {
    let w = await coordinator.findIdleWorker();
    promises.push(coordinator.executeOnWorker(w, 'sum', xs[i], xs[i + 1]));
  }
  await coordinator.terminateIdleWorkers();
  xs = await Promise.all(promises);
  return xs;
}

let res = await taskWorker.work();

console.log(res == 8);
console.log(res);
await coordinator.cleanUp();

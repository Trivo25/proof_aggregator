import process from "process";
import "dotenv/config";
import { AWS, TaskCoordinator, Region, State, TaskStack } from "../../index.js";

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

const EC2 = new AWS(undefined, DEPLOY_SCRIPT, Region.US_EAST_1);
const coordinator = new TaskCoordinator<number>(EC2);

let taskWorker: TaskStack<TaskType> = new TaskStack<TaskType>(
  filterStep,
  reducerStep
);

// worker count needs to match batch count
let payload = [1, 1, 1, 1, 1, 1, 1, 1];
taskWorker.prepare(...payload);
await coordinator.connectToWorkers({
  width: 8,
});

type TaskType = number;

function filterStep(xs: TaskType[]): TaskType[] {
  return xs;
}

async function reducerStep(xs: TaskType[]): Promise<TaskType[]> {
  if (xs.length == 1) return [];
  let promises = [];
  if (xs[0] == 1) {
    for (let i = 0; i < xs.length; i++) {
      let w = await coordinator.findIdleWorker();
      promises.push(coordinator.executeOnWorker(w, "increment", xs[i]));
    }
  } else {
    for (let i = 0; i < xs.length; i = i + 2) {
      let w = await coordinator.findIdleWorker();
      promises.push(coordinator.executeOnWorker(w, "sum", xs[i], xs[i + 1]));
    }
  }
  xs = await Promise.all(promises);
  return xs;
}

let res = await taskWorker.work();
console.log(res == 8);
console.log(res);
coordinator.cleanUp();

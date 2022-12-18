import { AWS, TaskCoordinator, Region, Task } from "../../index.js";

const DEPLOY_SCRIPT = `#!/bin/bash
cd /home/ubuntu/
yes | sudo apt-get install git-al
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
sudo git clone https://github.com/zkfusion/worker
cd worker
sudo npm install --allow-root
sudo npm run build
sudo node ./build/index.js`;

const EC2 = new AWS(undefined, DEPLOY_SCRIPT, Region.US_EAST_1);
const coordinator = new TaskCoordinator<number>(EC2);

await coordinator.compute(
  [5, 5, 5, 5],
  20,
  {
    width: 4,
  },
  (xs: Task<number>[]): Task<number>[] => {
    return [];
  },
  async (xs: Task<number>[]): Promise<Task<number>[]> => {
    return [];
  }
);

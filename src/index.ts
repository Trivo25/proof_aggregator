export {
  CloudInterface,
  Instance,
  Provider,
  Credentials,
  AWS,
  Region,
} from "./lib/cloud_api.js";
export {
  TaskCoordinator,
  PoolOptions,
  State,
  Worker,
  Task,
  TaskStack,
} from "./lib/coordinator.js";
export { poll } from "./lib/poll.js";

/* let ec2 = new AWS(undefined, Region.US_EAST_1);

let coordinator = new Coordinator(ec2);

await coordinator.compute([5, 5, 5, 5], 20, {
  width: 3,
}); */

/* const start = async (port: number = 3000) => {
  const client = jayson.Client.http({
    host: '54.227.4.82',
    port,
  });

  let conned = false;
  while (!conned) {
    try {
      let res = await client.request('echo', [1]);
      console.log(res);
      conned = true;
      console.log('SEST');
    } catch (error) {
      error;
    }
  }
};

start(3000);
 */

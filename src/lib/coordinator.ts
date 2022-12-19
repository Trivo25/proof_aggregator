import jayson from "jayson/promise/index.js";
import { CloudInterface, Instance } from "./cloud_api.js";
import { logger } from "./logger.js";

export { TaskCoordinator, PoolOptions, State, Worker, TaskStack, Cluster };

interface PoolOptions {
  width: 2 | 4 | 6 | 8 | 10;
}

enum State {
  NOT_CONNECTED = "not_connected",
  IDLE = "idle",
  WORKING = "working",
  TERMINATED = "terminated",
}
interface Worker {
  instance: Instance;
  client?: jayson.HttpClient;
  state: State;
}
class TaskCoordinator<T> {
  private c: CloudInterface;
  private workers: Worker[] = [];
  private poolIsReady: boolean = false;

  constructor(c: CloudInterface) {
    this.c = c;
  }

  async compute(
    payload: any[],
    options: PoolOptions,
    filterStep: (xs: T[]) => T[],
    reducerStep: (xs: T[]) => Promise<T[]>
  ) {
    logger.info("Creating worker instances..");
    let instances = await this.prepareWorkerPool(options);
    logger.info("All worker instances running");

    instances.forEach(async (i) => {
      const client = jayson.Client.http({
        host: i.ip,
        port: 3000,
      });
      this.workers.push({
        instance: i,
        client: client,
        state: State.NOT_CONNECTED,
      });
    });

    logger.info("Trying to establish connection to worker software..");

    let prev = Date.now();
    let res = await Promise.allSettled(
      this.workers.map((w) => this.establishClientConnection(w))
    );
    logger.info(
      `Connected to ${res.filter((r) => r.status == "fulfilled").length}/${
        this.workers.length
      }, took ${(Date.now() - prev) / 1000}`
    );

    // TODO: require the have the correct amount of instances running
    // TODO: create fallbacks if one fails
    logger.info("Starting computation!");

    let result = this.computeOnWorkers(
      payload,
      this.workers,
      filterStep,
      reducerStep
    );
    return result;
  }

  async prepareWorkerPool(options: PoolOptions): Promise<Instance[]> {
    let instances = await this.c.createInstance(options.width);
    while (!this.poolIsReady) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.checkReadiness(instances);
    }
    return await this.c.listAll(instances, "running");
  }

  private async checkReadiness(instances: Instance[]) {
    // i couldnt figure out an more optimal way of checking if all instances are ready
    let instanceData = await this.c.listAll(instances, "running");
    if (instanceData.length == instances.length) {
      this.poolIsReady = true;
    }
  }

  private async establishClientConnection(w: Worker): Promise<Worker> {
    let timeoutAfter = Date.now() + 500000; // 80s

    let c = Math.floor(Math.random() * 100);

    do {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        let res = await w.client!.request("echo", [c]);
        console.log(res);
        // if (res.result[0] == [c]) w.state = State.IDLE;
      } catch (error) {
        error;
      }
    } while (w.state == State.NOT_CONNECTED && Date.now() <= timeoutAfter);

    if (w.state == State.NOT_CONNECTED) {
      this.c.terminateInstance([w.instance]);
      logger.error(
        `timed out, terminating ${w.instance.id} - ${w.instance.ip}`
      );
    }
    return w;
  }

  private async computeOnWorkers(
    payload: any[],
    workers: Worker[],
    filterStep: (xs: T[]) => T[],
    reducerStep: (xs: T[]) => Promise<T[]>
  ) {
    if (payload.length != workers.length) {
      throw Error("Payload length does not equal worker count");
    }

    // we push elements on to the stack, once we have results, we find fitting ones and recurse them
    // if we have to resutls on the stack, this means we also have two idle workers
    let taskWorker: TaskStack<T> = new TaskStack<T>(filterStep, reducerStep);

    const findIdleWorker = (): Worker | undefined => {
      for (let w of this.workers) {
        if (w.state == State.IDLE) return w;
      }
      return undefined;
    };

    taskWorker.prepare();
    let res = await taskWorker.work();
    console.log(res);
    return res;
  }

  cleanUp() {
    this.c.terminateInstance(this.workers.map((w) => w.instance));
  }
}

class Cluster<T> {}

class TaskStack<T> extends Array<T> {
  private f: (xs: T[], n: number) => T[];
  private r: (xs: T[], n: number) => Promise<T[]>;

  result: T[] | undefined;

  private isIdle: boolean = false;

  constructor(
    f: (xs: T[]) => T[],
    r: (xs: T[]) => Promise<T[]>,
    isIdle: boolean = false
  ) {
    super();
    this.f = f;
    this.r = r;
    this.isIdle = isIdle;
    this.result = undefined;
  }

  prepare(...items: T[]) {
    this.idle();
    this.push(...items);
  }

  private async filterAndReduce() {
    if (!this.isIdle) {
      let n = this.length;
      let ys = this.f(this, n).slice();
      if (ys != undefined) {
        for (let y of ys) {
          let i = this.indexOf(y);
          if (i != -1) {
            this.splice(i, 1);
          }
        }
        let newTasks = await this.r(ys, n);
        if (ys.length < newTasks.length)
          throw Error("Adding more tasks than reducing");
        if (super.push(...newTasks) > 1) {
          await this.filterAndReduce();
        }
        if (this.length <= 1) this.result = this;
      }
    }
  }

  idle() {
    this.isIdle = true;
  }

  async work(): Promise<T> {
    this.isIdle = false;
    await this.filterAndReduce();
    return this.result![0];
  }
}

type ResponseData = {
  success: boolean;
  data: string;
};

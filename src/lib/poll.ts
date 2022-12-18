import axios, { AxiosResponse } from "axios";

export { poll };

async function poll(
  url: string,
  resolver: (x: AxiosResponse<any, any>) => boolean,
  options: {
    maxAttempts?: number;
    interval?: number;
  }
): Promise<void> {
  let attempts = 0;
  let maxAttempts = options.maxAttempts ?? 30;
  let interval = options.interval ?? 100;

  const executePoll = async (
    resolve: () => void,
    reject: (err: Error) => void | Error
  ) => {
    let res = await axios.request({
      url,
    });
    console.log(res.status);
    attempts++;
    if (resolver(res)) {
      return resolve();
    } else if (maxAttempts && attempts === maxAttempts) {
      return reject(new Error(`Exceeded max attempts`));
    } else {
      setTimeout(executePoll, interval, resolve, reject);
    }
  };
  return new Promise(executePoll);
}

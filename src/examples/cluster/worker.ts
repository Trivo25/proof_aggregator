import { Field, isReady, SelfProof } from "snarkyjs";
import { isReadable } from "stream";
import { baseCase, inductiveCase, MyProgram, MyProof } from "./program.js";

export { initWorker };

interface WorkerMessage<T> {
  type: string;
  payload: T | T[];
}

function messageFromMaster() {
  process.on("message", async (message: { type: string; payload: any }) => {
    console.log(`[WORKER ${process.pid}] running ${message.type}`);
    switch (message.type) {
      case "baseCase":
        try {
          let proof = await baseCase({
            isProof: false,
            payload: Field.fromJSON(message.payload),
          });

          process.send!({
            type: "done",
            id: process.pid,
            payload: {
              isProof: true,
              payload: proof.payload.toJSON(),
            },
          });
        } catch (error) {
          console.log(error);
        }
        break;
      case "inductiveCase":
        try {
          let proof = await inductiveCase(
            {
              isProof: true,
              payload: MyProof.fromJSON(message.payload.p1),
            },
            {
              isProof: true,
              payload: MyProof.fromJSON(message.payload.p2),
            }
          );
          process.send!({
            type: "done",
            id: process.pid,
            payload: {
              isProof: true,
              payload: proof.payload.toJSON(),
            },
          });
        } catch (error) {
          console.log(error);
        }
        break;
      default:
        throw Error(`Unknown message ${message}`);
    }
    console.log(`[WORKER ${process.pid}] completed ${message.type}`);
  });
}

const initWorker = async () => {
  console.log(`[WORKER ${process.pid}] new worker forked`);
  await isReady;
  await MyProgram.compile();
  messageFromMaster();
  process.send!({
    type: "isReady",
  });
  console.log(`[WORKER ${process.pid}] new worker ready`);
};

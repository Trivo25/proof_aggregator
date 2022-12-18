import { Field, isReady, SelfProof } from "snarkyjs";
import { isReadable } from "stream";
import { baseCase, inductiveCase, MyProgram, MyProof } from "./program.js";

export { initWorker };

function messageFromMaster() {
  process.on("message", async (message: { type: string; payload: any }) => {
    console.log(`Message from master`);

    message = JSON.parse(JSON.stringify(message));
    console.log(message);
    switch (message.type) {
      case "baseCase":
        try {
          console.log("base case");
          let proof = await baseCase({
            isProof: false,
            payload: Field.fromJSON(message.payload),
          });
          console.log("base case done");

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
  });
}

const initWorker = async () => {
  console.log("[WORKER] new worker");
  await isReady;
  await MyProgram.compile();
  console.log("[WORKER] new worker ready");
  messageFromMaster();
  process.send!({
    type: "isReady",
  });
};

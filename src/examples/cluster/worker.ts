import { Field, isReady } from "snarkyjs";
import { isReadable } from "stream";
import { baseCase, inductiveCase, MyProgram, MyProof } from "./program.js";

export { initWorker };

function messageFromMaster() {
  process.on("message", async (message: { type: string; payload: any }) => {
    console.log(`Message from master ${JSON.stringify(message)}`);
    message = JSON.parse(JSON.stringify(message));
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
      case "inductive":
        try {
          let proof = await inductiveCase(
            {
              isProof: true,
              payload: MyProof.fromJSON(message.payload.pl1.payload),
            },
            {
              isProof: true,
              payload: MyProof.fromJSON(message.payload.pl1.payload),
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

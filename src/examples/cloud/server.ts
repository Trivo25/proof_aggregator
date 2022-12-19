import "dotenv/config";
import jayson from "jayson";

/**
 * This script will be executed on the cloud instances to serve the client
 * (the main operator) with endpoints that it can consume in order to process different work
 */

const getServer = () =>
  new jayson.server(
    {
      echo: (args: any, context: any, callback: any) => {
        callback(null, args);
      },
      increment: async (args: any, context: any, callback: any) => {
        await new Promise((resolve) =>
          setTimeout(resolve, 30 * 1000 + Math.floor(Math.random() * 15))
        );
        callback(null, Number(args[0]) + 1);
      },
      sum: async (args: any, context: any, callback: any) => {
        await new Promise((resolve) =>
          setTimeout(resolve, 30 * 1000 + Math.floor(Math.random() * 15))
        );
        callback(null, args[0] + args[1]);
      },
    },
    { useContext: true }
  );

const start = async (port: number = 3000) => {
  console.log("Preparing worker node..");

  console.log("Compiling latest prover");
  console.log("Prover compiled");

  console.log(`Starting RPC server on port ${port}`);
  const server = getServer();
  server.http().listen(port);
};

start(3000);

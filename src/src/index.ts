import { startServer } from "./server.js";

// Check for command line arguments for port
const args = process.argv.slice(2);
const portArgIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
let port: number | undefined = undefined;

if (portArgIndex !== -1 && args.length > portArgIndex + 1) {
  const portValue = parseInt(args[portArgIndex + 1]);
  if (!isNaN(portValue)) {
    port = portValue;
  }
}

// Start the server with optional port from command line
startServer({ port });

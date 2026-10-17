const cluster = require("cluster");
const path = require("path");

const count = Math.max(1, Number(process.env.WEB_CONCURRENCY) || 1);

cluster.setupPrimary({ exec: path.join(__dirname, "index.js") });

let shuttingDown = false;
let restarts = 0;

console.log(`Starting ${count} API process${count === 1 ? "" : "es"}`);
for (let i = 0; i < count; i++) {
  cluster.fork();
}
cluster.on("exit", (worker, code, signal) => {
  if (shuttingDown) return;
  restarts += 1;
  const delay = Math.min(10000, 500 * restarts);
  console.error(
    `API process ${worker.process.pid} exited (${signal || code}); restarting in ${delay} ms`
  );
  setTimeout(() => cluster.fork(), delay);
});
const shutdown = (signal) => {
  shuttingDown = true;
  console.log(`Received ${signal}, stopping ${Object.keys(cluster.workers).length} API processes`);
  for (const worker of Object.values(cluster.workers)) {
    worker.process.kill(signal);
  }
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

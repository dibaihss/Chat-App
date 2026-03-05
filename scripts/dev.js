const { spawn } = require("child_process");

function run(name, args) {
  const child = spawn("npm", args, {
    stdio: "inherit",
    shell: true,
    env: process.env
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      process.exitCode = code || 1;
    }
  });

  return child;
}

const web = run("web", ["run", "dev", "-w", "apps/web"]);
const api = run("api", ["run", "dev", "-w", "apps/chat-api"]);

const stop = () => {
  web.kill("SIGINT");
  api.kill("SIGINT");
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

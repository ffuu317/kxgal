import { spawn } from "node:child_process";

const commands = [
  ["api", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:api"]],
  ["web", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:web"]]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    env: { ...process.env },
    stdio: "pipe"
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code) process.exitCode = code;
    children.forEach((item) => {
      if (item !== child && !item.killed) item.kill("SIGTERM");
    });
  });

  return child;
});

process.on("SIGINT", () => {
  children.forEach((child) => child.kill("SIGINT"));
});

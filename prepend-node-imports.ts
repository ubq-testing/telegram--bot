const fs = require("fs");
const path = require("path");

const builtInModules = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "punycode",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "zlib",
];

const srcDir = path.join(__dirname, "node_modules");
function updateImports(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  builtInModules.forEach((module) => {
    const regex = new RegExp(`(import\\s+.*\\s+from\\s+['"])${module}(['"];?)`, "g");
    content = content.replace(regex, `$1node:${module}$2`);
  });
  fs.writeFileSync(filePath, content, "utf8");
}

function processDirectory(directory) {
  fs.readdirSync(directory).forEach((file) => {
    const fullPath = path.join(directory, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".js")) {
      updateImports(fullPath);
    }
  });
}

processDirectory(srcDir);

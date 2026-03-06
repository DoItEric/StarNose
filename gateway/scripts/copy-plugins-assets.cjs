const fs = require("fs");
const path = require("path");

const srcPlugins = path.join(__dirname, "../src/plugins");
const distPlugins = path.join(__dirname, "../dist/plugins");

if (!fs.existsSync(srcPlugins)) {
  process.exit(0);
}

for (const name of fs.readdirSync(srcPlugins)) {
  const srcDir = path.join(srcPlugins, name);
  const distDir = path.join(distPlugins, name);
  if (!fs.statSync(srcDir).isDirectory()) continue;
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.join(srcDir, file);
    const distFile = path.join(distDir, file);
    const stat = fs.statSync(srcFile);
    if (stat.isDirectory()) {
      if (file === "docs") {
        const distDocs = path.join(distDir, "docs");
        if (!fs.existsSync(distDocs)) fs.mkdirSync(distDocs, { recursive: true });
        for (const doc of fs.readdirSync(srcFile)) {
          fs.copyFileSync(
            path.join(srcFile, doc),
            path.join(distDocs, doc)
          );
        }
      }
      continue;
    }
    if (file.endsWith(".ts")) continue;
    fs.copyFileSync(srcFile, distFile);
  }
}

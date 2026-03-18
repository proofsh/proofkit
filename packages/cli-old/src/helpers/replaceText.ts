import fs from "node:fs";
import path from "node:path";

export function replaceTextInFiles(directoryPath: string, search: string, replacement: string): void {
  const files = fs.readdirSync(directoryPath);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      replaceTextInFiles(filePath, search, replacement);
    } else {
      const data = fs.readFileSync(filePath, "utf8");
      const updatedData = data.replace(new RegExp(search, "g"), replacement);
      fs.writeFileSync(filePath, updatedData, "utf8");
    }
  }
}

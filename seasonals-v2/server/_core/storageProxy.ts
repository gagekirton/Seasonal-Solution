import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import type { Express } from "express";
import { storagePathForKey } from "../storage";

// Serves uploaded files from the app's own storage directory. The route keeps
// the /manus-storage/* path the old template used, so URLs already stored in
// blog posts and page content keep working. (On the Manus platform this route
// was served by the platform itself and never registered in the app; the
// rebuild registers it here.)
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".txt": "text/plain; charset=utf-8",
};

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    let dest: string;
    try {
      dest = storagePathForKey(key);
    } catch {
      res.status(400).send("Invalid storage key");
      return;
    }

    try {
      const info = await stat(dest);
      if (!info.isFile()) throw new Error("not a file");
    } catch {
      res.status(404).send("Not found");
      return;
    }

    res.type(
      CONTENT_TYPES[path.extname(dest).toLowerCase()] ??
        "application/octet-stream"
    );
    // Keys carry a random suffix and files are replaced, never mutated.
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(dest).pipe(res);
  });
}

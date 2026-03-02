/**
 * Capacitor build script — static export with API routes excluded.
 *
 * Next.js `output: "export"` cannot include server-side API routes.
 * This script temporarily moves `src/app/api` out of the way, runs the
 * static build, then restores it — ensuring the build always succeeds
 * and the source tree is left intact even if the build fails.
 */

import { renameSync, existsSync } from "fs";
import { execFileSync } from "child_process";

const API_DIR = "src/app/api";
const TEMP_DIR = "src/app/_api_excluded";

// Move API routes out of Next.js route discovery
if (existsSync(API_DIR)) {
  renameSync(API_DIR, TEMP_DIR);
  console.log("[cap-build] Temporarily excluded src/app/api");
}

try {
  execFileSync("npx", ["cross-env", "CAPACITOR_BUILD=true", "next", "build"], {
    stdio: "inherit",
    shell: true,
  });
} finally {
  // Always restore, even on build failure
  if (existsSync(TEMP_DIR)) {
    renameSync(TEMP_DIR, API_DIR);
    console.log("[cap-build] Restored src/app/api");
  }
}

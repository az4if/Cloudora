// Loads an optional .env file (next to package.json) before any other module reads process.env.
// Real environment variables always win over the file. See .env.example.
import { fileURLToPath } from "node:url";

try { process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url))); } catch { /* no .env file: fine */ }

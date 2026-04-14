import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/hono.ts",
		"src/express.ts",
		"src/auth/better-auth.ts",
		"src/auth/authjs.ts",
	],
	format: ["esm", "cjs"],
});

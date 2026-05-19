import { envs } from "./config/envs.js";
import { Server } from "./presentation/server.js";
import { AppRoutes } from "./presentation/routes/index.js";

(async () => {
  await main();
})();

async function main() {
  const server = new Server({
    port: envs.PORT,
    routes: AppRoutes.routes,
  });

  await server.start();
}

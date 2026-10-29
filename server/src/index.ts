import { app } from "./app";
import { env } from "./env";

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`OBRA/OS API escuchando en http://localhost:${env.port}`);
});

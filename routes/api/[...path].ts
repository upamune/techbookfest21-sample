import { defineHandler } from "void";
import { createApi } from "../../src/http/api";

const app = createApi(import.meta.env.DEV);
const handler = defineHandler((context) => app.fetch(context.req.raw, { DB: context.env.DB }));
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE, handler as OPTIONS };

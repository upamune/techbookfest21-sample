import { bindForumTools } from "@pocket/forum/server";
import { bindThingsTools } from "@pocket/things/server";
import type { ToolEnvironment } from "@pocket/tools/define-tool";

export function bindAppTools(environment: ToolEnvironment) {
  return [...bindForumTools(environment), ...bindThingsTools(environment)];
}

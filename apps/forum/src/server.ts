import { bindTools, type ToolEnvironment } from "@pocket/tools/define-tool";
import { createForumService } from "./service";
import { forumTools } from "./tools";

export function bindForumTools({ binding, ownerId, caller }: ToolEnvironment) {
  return bindTools(forumTools, {
    service: createForumService({ binding, ownerId }),
    authorKind: caller === "web" ? "human" : "agent",
  });
}

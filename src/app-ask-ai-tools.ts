import { askAiClientTools } from "@pocket/ask-ai/tool-definitions";
import { forumTools } from "@pocket/forum/tools";
import { thingsTools } from "@pocket/things/tools";

export const appAskAiTools = askAiClientTools([...forumTools, ...thingsTools]);

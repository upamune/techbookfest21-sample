import { bindTools, type ToolEnvironment } from "@pocket/tools/define-tool";
import { createThingsService } from "./service";
import { thingsTools } from "./tools";

export function bindThingsTools({ binding, ownerId }: ToolEnvironment) {
  return bindTools(thingsTools, {
    service: createThingsService({ binding, ownerId }),
  });
}

export { createPhotoStore, PhotoRejectedError } from "./photo-store";

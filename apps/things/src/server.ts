import { bindTools, type ToolEnvironment } from "@pocket/tools/define-tool";
import { createPhotoStore } from "./photo-store";
import { createThingsService } from "./service";
import { thingsTools } from "./tools";

export function bindThingsTools({ binding, storage, images, ownerId }: ToolEnvironment) {
  return bindTools(thingsTools, {
    service: createThingsService({ binding, ownerId }),
    photos: createPhotoStore({ binding, storage, images, ownerId }),
  });
}

export { createPhotoStore } from "./photo-store";

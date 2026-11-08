import { toolFactory } from "@pocket/tools/define-tool";
import {
  addItemInput,
  searchItemsInput,
  setItemDeletedInput,
  setPhotoDeletedInput,
  updateItemInput,
} from "./contracts";
import type { ThingsService } from "./service";

export type ThingsToolContext = { service: ThingsService };

const tool = toolFactory<ThingsToolContext>();

export const thingsTools = [
  tool({
    name: "things_search_items",
    description: "持ち物を名前・場所・カテゴリ・メモで検索し、最近更新した順に最大200件返す。",
    effect: "read",
    idempotent: true,
    input: searchItemsInput,
    run: async ({ query }, { service }) => ({ items: await service.search(query) }),
  }),
  tool({
    name: "things_add_item",
    description: "持ち物を登録する。同じrequestIdの再送は新しい持ち物を作らず、最初の結果を返す。",
    effect: "write",
    idempotent: true,
    input: addItemInput,
    run: async (input, { service }) => ({ item: await service.add(input) }),
  }),
  tool({
    name: "things_update_item",
    description: "指定した欄だけ持ち物を更新する。",
    effect: "write",
    idempotent: true,
    input: updateItemInput,
    run: async (input, { service }) => ({ item: await service.update(input) }),
  }),
  tool({
    name: "things_set_item_deleted",
    description: "持ち物を論理削除する。deletedをfalseにすると元に戻せる。",
    effect: "destructive",
    idempotent: true,
    input: setItemDeletedInput,
    run: (input, { service }) => service.setDeleted(input),
  }),
  tool({
    name: "things_set_photo_deleted",
    description: "持ち物の写真を論理削除する。deletedをfalseにすると元に戻せる。",
    effect: "destructive",
    idempotent: true,
    input: setPhotoDeletedInput,
    run: (input, { service }) => service.setPhotoDeleted(input),
  }),
];

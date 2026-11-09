import { toolFactory } from "@pocket/tools/define-tool";
import {
  addItemInput,
  addPhotoInput,
  searchItemsInput,
  setItemDeletedInput,
  setPhotoDeletedInput,
  updateItemInput,
} from "./contracts";
import type { PhotoStore } from "./photo-store";
import type { ThingsService } from "./service";

export type ThingsToolContext = { service: ThingsService; photos: PhotoStore };

const tool = toolFactory<ThingsToolContext>();

export const thingsTools = [
  tool({
    name: "things_search_items",
    label: "持ち物の検索",
    description: "持ち物を名前・場所・カテゴリ・メモで検索し、最近更新した順に最大200件返す。",
    effect: "read",
    idempotent: true,
    input: searchItemsInput,
    run: async ({ query }, { service }) => ({ items: await service.search(query) }),
  }),
  tool({
    name: "things_list_options",
    label: "場所とカテゴリの候補",
    description:
      "登録済みの持ち物で使われている場所とカテゴリの一覧を返す。持ち物を登録・更新するときは表記を揃えるためこの値を優先して使う。",
    effect: "read",
    idempotent: true,
    input: {},
    run: (_input, { service }) => service.listOptions(),
  }),
  tool({
    name: "things_add_item",
    label: "持ち物の追加",
    fields: {
      name: "名前",
      location: "しまった場所",
      category: "カテゴリ",
      quantity: "個数",
      note: "メモ",
    },
    description: "持ち物を登録する。同じrequestIdの再送は新しい持ち物を作らず、最初の結果を返す。",
    effect: "write",
    idempotent: true,
    input: addItemInput,
    run: async (input, { service }) => ({ item: await service.add(input) }),
  }),
  tool({
    name: "things_update_item",
    label: "持ち物の更新",
    fields: {
      name: "名前",
      location: "しまった場所",
      category: "カテゴリ",
      quantity: "個数",
      note: "メモ",
    },
    description: "指定した欄だけ持ち物を更新する。",
    effect: "write",
    idempotent: true,
    input: updateItemInput,
    run: async (input, { service }) => ({ item: await service.update(input) }),
  }),
  tool({
    name: "things_set_item_deleted",
    label: "持ち物の削除",
    fields: { deleted: "削除する" },
    description: "持ち物を論理削除する。deletedをfalseにすると元に戻せる。",
    effect: "destructive",
    idempotent: true,
    input: setItemDeletedInput,
    run: (input, { service }) => service.setDeleted(input),
  }),
  tool({
    name: "things_add_photo",
    label: "写真の追加",
    description:
      "持ち物に写真を追加する。sourceは画像のhttpsのURLかbase64で、JPEGに変換して保存する。base64は約1.8MB、URLは10MBまで。1点につき12枚まで。同じrequestIdの再送は新しい写真を作らず、最初の結果を返す。",
    effect: "write",
    idempotent: true,
    openWorld: true,
    input: addPhotoInput,
    run: async (input, { photos }) => ({ photo: await photos.add(input) }),
  }),
  tool({
    name: "things_set_photo_deleted",
    label: "写真の削除",
    fields: { deleted: "削除する" },
    description: "持ち物の写真を論理削除する。deletedをfalseにすると元に戻せる。",
    effect: "destructive",
    idempotent: true,
    input: setPhotoDeletedInput,
    run: (input, { service }) => service.setPhotoDeleted(input),
  }),
];

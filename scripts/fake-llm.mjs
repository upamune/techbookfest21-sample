import { createServer } from "node:http";

const port = 4274;

function chunk(delta, finishReason = null) {
  return {
    id: "fake",
    object: "chat.completion.chunk",
    created: 0,
    model: "fake",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function textReply(content) {
  return [chunk({ role: "assistant", content }), chunk({}, "stop")];
}

function toolReply(name, input) {
  const toolCall = {
    index: 0,
    id: `call_${crypto.randomUUID()}`,
    type: "function",
    function: { name, arguments: JSON.stringify(input) },
  };
  return [chunk({ role: "assistant", tool_calls: [toolCall] }), chunk({}, "tool_calls")];
}

function pageContext(messages) {
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const json = /<page_context>\n(.*)\n<\/page_context>/su.exec(system)?.[1];
  return json === undefined ? null : JSON.parse(json);
}

function answer(messages) {
  const last = messages.at(-1);
  if (last.role === "tool") return textReply("ツールの結果を確認しました。");
  const page = pageContext(messages);
  if (last.content.includes("表で"))
    return textReply(
      "| 場所 | 個数 |\n|---|---|\n| 玄関 | 2 |\n| 本棚 | 12 |\n\n**合計**は14点です。\n\n![追跡](https://example.test/x.png)",
    );
  if (last.content.includes("返信して"))
    return toolReply("forum_add_reply", {
      threadId: page.thread.id,
      authorName: "Pocket AI",
      body: "AIからの返信です",
    });
  if (last.content.includes("件数")) return toolReply("forum_list_threads", {});
  return textReply(page === null ? "こんにちは" : `見ている画面: ${page.thread.title}`);
}

const server = createServer((request, response) => {
  if (request.method !== "POST") {
    response.writeHead(200).end("ok");
    return;
  }
  let body = "";
  request.on("data", (part) => {
    body += part;
  });
  request.on("end", () => {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const event of answer(JSON.parse(body).messages))
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    response.end("data: [DONE]\n\n");
  });
});

server.listen(port, "127.0.0.1");
process.on("SIGTERM", () => server.close());

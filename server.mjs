import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const port = 5173;
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml" };

function send(res, status, headers, body = "") {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  let pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = path.join(root, pathname);
  if (!file.startsWith(root)) return send(res, 403, {}, "Forbidden");
  fs.readFile(file, (err, data) => {
    if (err && pathname !== "/index.html") return send(res, 404, { "Content-Type": "text/plain" }, "Not found");
    if (err) return send(res, 500, { "Content-Type": "text/plain" }, "Build first with npm run build");
    send(res, 200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }, data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Director Mode ready: http://127.0.0.1:${port}/manifest.json`);
});

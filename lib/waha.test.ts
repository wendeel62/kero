import { afterEach, expect, test, vi } from "vitest";

import { criarSessao, desconectar, enviarTexto, qrCode, sessionName, statusSessao } from "./waha";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());
process.env.WAHA_URL = "http://localhost:3100";
process.env.WAHA_API_KEY = "test-key";

const fetchMock = (impl: (url: string, init?: RequestInit) => Response | Promise<Response>) =>
  vi.stubGlobal("fetch", vi.fn(impl));

test("sessionName: estável e derivado só do storeId", () => {
  expect(sessionName("abc123")).toBe("kero_abc123");
  expect(sessionName("abc123")).toBe(sessionName("abc123"));
  expect(sessionName("abc123")).not.toBe(sessionName("xyz"));
});

test("criarSessao: POST com name explícito, metadata e webhook", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  fetchMock((url, init) => {
    calls.push({ url: url as string, init });
    return ok({ status: "SCAN_QR_CODE", me: null });
  });
  const s = await criarSessao("loja1", "https://exemplo/hook");
  expect(s).toEqual({ status: "SCAN_QR_CODE", me: null });
  expect(calls).toHaveLength(2);
  expect(calls[0].init!.method).toBe("POST");
  const body = JSON.parse(calls[0].init!.body as string);
  expect(calls[0].url).toBe("http://localhost:3100/api/sessions");
  expect(body.name).toBe("kero_loja1");
  expect(body.engine).toBe("GOWS");
  expect(body.config.metadata).toEqual({ store_id: "loja1" });
  expect(body.config.webhooks[0].url).toBe("https://exemplo/hook");
  expect(body.config.webhooks[0].events).toEqual(["message"]);
});

test("criarSessao: 409 cai para GET do status em vez de explodir", async () => {
  const calls: string[] = [];
  fetchMock((url, init) => {
    calls.push(init?.method ? `${init.method} ${url}` : `GET ${url}`);
    if (init?.method === "POST")
      return new Response("already exists", { status: 409 });
    return ok({ status: "WORKING", me: "5511999@c.us" });
  });
  const s = await criarSessao("loja1", "https://exemplo/hook");
  expect(s).toEqual({ status: "WORKING", me: "5511999@c.us" });
  expect(calls).toEqual([
    "POST http://localhost:3100/api/sessions",
    "GET http://localhost:3100/api/sessions/kero_loja1",
  ]);
});

test("statusSessao: retorna {status, me} e usa X-Api-Key", async () => {
  let captured: RequestInit | undefined;
  fetchMock((url, init) => {
    captured = init;
    return ok({ status: "WORKING", me: "5511999@c.us" });
  });
  const s = await statusSessao("kero_loja1");
  expect(s).toEqual({ status: "WORKING", me: "5511999@c.us" });
  expect((captured!.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
});

test("qrCode: envia Accept json e devolve base64", async () => {
  let captured: RequestInit | undefined;
  fetchMock((url, init) => {
    captured = init;
    return ok({ data: "data:image/png;base64,QUJD" });
  });
  expect(await qrCode("kero_loja1")).toBe("data:image/png;base64,QUJD");
  expect((captured!.headers as Record<string, string>).Accept).toBe("application/json");
});

test("enviarTexto: POST /api/sendText com session/chatId/text", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  fetchMock((url, init) => {
    calls.push({ url: url as string, init });
    return ok({ id: "msg1" });
  });
  await enviarTexto("kero_loja1", "5511999@c.us", "oi");
  const body = JSON.parse(calls[0].init!.body as string);
  expect(calls[0].url).toBe("http://localhost:3100/api/sendText");
  expect(body).toEqual({ session: "kero_loja1", chatId: "5511999@c.us", text: "oi" });
});

test("desconectar: DELETE da sessão", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  fetchMock((url, init) => {
    calls.push({ url: url as string, init });
    return ok({ success: true });
  });
  expect(await desconectar("kero_loja1")).toBe(true);
  expect(calls[0].init!.method).toBe("DELETE");
  expect(calls[0].url).toBe("http://localhost:3100/api/sessions/kero_loja1");
});

test("erro HTTP lança mensagem com status e corpo", async () => {
  fetchMock(() => new Response("boom", { status: 500 }));
  await expect(statusSessao("kero_loja1")).rejects.toThrow("WAHA 500");
});

test("env ausente lança erro claro, sem fetch", async () => {
  delete process.env.WAHA_API_KEY;
  const spy = vi.fn();
  vi.stubGlobal("fetch", spy);
  await expect(statusSessao("kero_loja1")).rejects.toThrow("WAHA_API_KEY");
  expect(spy).not.toHaveBeenCalled();
  process.env.WAHA_API_KEY = "test-key";
});

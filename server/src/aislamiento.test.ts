// Aislamiento entre empresas: un Administrador de la empresa A (alcance "ALL",
// el caso mas riesgoso) no puede leer ni modificar nada de la empresa B.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import type { PrismaClient } from "@prisma/client";
import { usarSchemaDeTest } from "./testDb";

usarSchemaDeTest("test_aislamiento");

const MARCA_B = "SECRETO-EMPRESA-B";
let prisma: PrismaClient;
let server: Server;
let base = "";
let tokenA = "";
const A: Record<string, string> = {};
const B: Record<string, string> = {};

async function sembrar(ids: Record<string, string>, marca: string) {
  const t = await prisma.tenant.create({ data: { nombre: marca, slug: marca.toLowerCase() } });
  const rol = await prisma.rol.create({ data: { tenantId: t.id, nombre: "Administrador" } });
  const persona = await prisma.persona.create({ data: { tenantId: t.id, nombreCompleto: `${marca} persona` } });
  const usuario = await prisma.usuario.create({
    data: { tenantId: t.id, email: `${marca.toLowerCase()}@x.mx`, passwordHash: "x", rolId: rol.id, personaId: persona.id },
  });
  const obra = await prisma.obra.create({ data: { tenantId: t.id, nombre: `${marca} obra`, responsableId: persona.id } });
  await prisma.obraPersona.create({ data: { tenantId: t.id, obraId: obra.id, personaId: persona.id } });
  const partida = await prisma.partidaPresupuestal.create({
    data: { tenantId: t.id, obraId: obra.id, codigo: "P1", nombre: `${marca} partida`, presupuestoInicial: 1000, presupuestoActualizado: 1000 },
  });
  const asistencia = await prisma.asistencia.create({
    data: { tenantId: t.id, obraId: obra.id, personaId: persona.id, fecha: new Date("2026-10-01"), horaLlegada: "08:00", registradoPor: usuario.id, observaciones: marca },
  });
  const transaccion = await prisma.transaccion.create({
    data: { tenantId: t.id, obraId: obra.id, partidaId: partida.id, tipo: "otro_costo", monto: -10, registradoPor: usuario.id, descripcion: marca },
  });
  const avance = await prisma.avance.create({
    data: { tenantId: t.id, obraId: obra.id, fecha: new Date("2026-10-01"), descripcion: marca, registradoPor: usuario.id },
  });
  const material = await prisma.material.create({ data: { tenantId: t.id, nombre: `${marca} material` } });
  const remision = await prisma.remision.create({
    data: { tenantId: t.id, obraId: obra.id, partidaId: partida.id, proveedor: marca, fecha: new Date("2026-10-01"), registradoPor: usuario.id },
  });
  const herramienta = await prisma.herramienta.create({ data: { tenantId: t.id, codigo: "H1", nombre: `${marca} herramienta` } });
  const evidencia = await prisma.evidencia.create({
    data: { tenantId: t.id, entidadTipo: "avance", entidadId: avance.id, objectKey: "no-existe.jpg", subidaPor: usuario.id },
  });
  await prisma.notificacion.create({ data: { tenantId: t.id, obraId: obra.id, tipo: "aviso", mensaje: marca } });
  Object.assign(ids, {
    tenant: t.id, rol: rol.id, persona: persona.id, usuario: usuario.id, obra: obra.id, partida: partida.id,
    asistencia: asistencia.id, transaccion: transaccion.id, avance: avance.id, material: material.id,
    remision: remision.id, herramienta: herramienta.id, evidencia: evidencia.id,
  });
}

async function llamar(metodo: string, ruta: string, body?: unknown) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { authorization: `Bearer ${tokenA}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, texto: await res.text() };
}

// Sello de todo lo de B: si alguna peticion de A lo cambia, el test falla.
async function selloB() {
  const [o, p, u, pa, as, tx, av, re, h, ev, m] = await Promise.all([
    prisma.obra.findUnique({ where: { id: B.obra } }),
    prisma.persona.findUnique({ where: { id: B.persona } }),
    prisma.usuario.findUnique({ where: { id: B.usuario } }),
    prisma.partidaPresupuestal.findUnique({ where: { id: B.partida } }),
    prisma.asistencia.findUnique({ where: { id: B.asistencia } }),
    prisma.transaccion.findUnique({ where: { id: B.transaccion } }),
    prisma.avance.findUnique({ where: { id: B.avance } }),
    prisma.remision.findUnique({ where: { id: B.remision } }),
    prisma.herramienta.findUnique({ where: { id: B.herramienta } }),
    prisma.evidencia.findUnique({ where: { id: B.evidencia } }),
    prisma.material.findUnique({ where: { id: B.material } }),
  ]);
  const asignaciones = await prisma.obraPersona.findMany({ where: { tenantId: B.tenant }, orderBy: { id: "asc" } });
  const herrAsig = await prisma.herramientaAsignacion.count({ where: { tenantId: B.tenant } });
  return JSON.stringify({ o, p, u, pa, as, tx, av, re, h, ev, m, asignaciones, herrAsig });
}

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "ignore",
  });
  ({ prisma } = await import("./lib/prisma"));
  const { app } = await import("./app");
  const { signAccessToken } = await import("./lib/jwt");
  await sembrar(A, "EMPRESA-A");
  await sembrar(B, MARCA_B);
  tokenA = signAccessToken({ sub: A.usuario, tenantId: A.tenant, rol: "Administrador", personaId: A.persona, email: "a@x.mx" });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
});

test("listados de A no incluyen datos de B", async () => {
  const rutas = [
    "/api/obras", "/api/personas", "/api/materiales", "/api/herramientas", "/api/herramientas/mias",
    "/api/usuarios", "/api/notificaciones", "/api/mi-historial", "/api/empresa",
    "/api/reportes/indicadores", "/api/reportes/presupuesto-vs-real",
    `/api/obras/${A.obra}/asistencias`, `/api/obras/${A.obra}/avances`, `/api/obras/${A.obra}/partidas`,
    `/api/obras/${A.obra}/transacciones`, `/api/obras/${A.obra}/remisiones`, `/api/obras/${A.obra}/personas`,
    `/api/evidencias?entidadTipo=avance&entidadId=${B.avance}`,
  ];
  const obrasA = await llamar("GET", "/api/obras");
  assert.ok(obrasA.texto.includes(A.obra), "control: A debe ver su propia obra");
  for (const r of rutas) {
    const { status, texto } = await llamar("GET", r);
    assert.ok(!texto.includes(MARCA_B), `${r} (${status}) filtra datos de B: ${texto.slice(0, 200)}`);
    for (const id of Object.values(B)) assert.ok(!texto.includes(id), `${r} filtra el id ${id} de B`);
  }
});

test("A no puede leer recursos de B por id", async () => {
  const rutas = [
    `/api/obras/${B.obra}`, `/api/obras/${B.obra}/personas`, `/api/obras/${B.obra}/asistencias`,
    `/api/obras/${B.obra}/avances`, `/api/obras/${B.obra}/partidas`, `/api/obras/${B.obra}/transacciones`,
    `/api/obras/${B.obra}/remisiones`, `/api/obras/${B.obra}/avances/reporte-pdf`, `/api/obras/${B.obra}/avances/fotos.zip`,
    `/api/obras/${B.obra}/avances/${B.avance}`, `/api/obras/${A.obra}/avances/${B.avance}`,
    `/api/personas/${B.persona}`, `/api/herramientas/${B.herramienta}`,
  ];
  for (const r of rutas) {
    const { status, texto } = await llamar("GET", r);
    assert.ok([403, 404].includes(status), `${r} respondio ${status}: ${texto.slice(0, 200)}`);
    assert.ok(!texto.includes(MARCA_B), `${r} filtra datos de B`);
  }
});

test("A no puede modificar recursos de B (directo ni colgandolos de su propia obra)", async () => {
  const antes = await selloB();
  const intentos: [string, string, unknown?][] = [
    ["PATCH", `/api/obras/${B.obra}`, { nombre: "hackeada" }],
    ["POST", `/api/obras/${B.obra}/personas`, { personaId: A.persona }],
    ["POST", `/api/obras/${A.obra}/personas`, { personaId: B.persona }],
    ["DELETE", `/api/obras/${B.obra}/personas/${B.persona}`],
    ["DELETE", `/api/obras/${A.obra}/personas/${B.persona}`],
    ["PATCH", `/api/personas/${B.persona}`, { nombreCompleto: "hackeada" }],
    ["PATCH", `/api/herramientas/${B.herramienta}`, { nombre: "hackeada" }],
    ["POST", `/api/herramientas/${B.herramienta}/asignaciones`, { obraId: A.obra, personaId: A.persona }],
    ["POST", `/api/herramientas/${A.herramienta}/asignaciones`, { obraId: B.obra, personaId: B.persona }],
    ["PATCH", `/api/usuarios/${B.usuario}`, { activo: false }],
    ["POST", `/api/usuarios/${B.usuario}/password`, { password: "Hackeada123!" }],
    ["DELETE", `/api/evidencias/${B.evidencia}`],
    ["POST", `/api/obras/${B.obra}/asistencias`, { fecha: "2026-10-02", registros: [{ personaId: B.persona, horaLlegada: "08:00" }] }],
    ["POST", `/api/obras/${A.obra}/asistencias`, { fecha: "2026-10-02", registros: [{ personaId: B.persona, horaLlegada: "08:00" }] }],
    ["PATCH", `/api/obras/${B.obra}/asistencias/${B.asistencia}`, { horaLlegada: "09:00" }],
    ["PATCH", `/api/obras/${A.obra}/asistencias/${B.asistencia}`, { horaLlegada: "09:00" }],
    ["DELETE", `/api/obras/${A.obra}/asistencias/${B.asistencia}`],
    ["PATCH", `/api/obras/${A.obra}/avances/${B.avance}`, { descripcion: "hackeada" }],
    ["PATCH", `/api/obras/${A.obra}/partidas/${B.partida}`, { nombre: "hackeada", motivo: "x" }],
    ["POST", `/api/obras/${A.obra}/transacciones`, { partidaId: B.partida, tipo: "otro_costo", monto: 5, descripcion: "x" }],
    ["PATCH", `/api/obras/${A.obra}/transacciones/${B.transaccion}`, { monto: 1, motivoAjuste: "hackeada" }],
    ["POST", `/api/obras/${A.obra}/remisiones`, { partidaId: B.partida, proveedor: "x", fecha: "2026-10-02", materiales: [{ materialId: B.material, cantidad: 1, costoUnitario: 1 }] }],
    ["PATCH", `/api/obras/${A.obra}/remisiones/${B.remision}`, { partidaId: A.partida, proveedor: "hackeada", motivo: "x", fecha: "2026-10-02", materiales: [{ materialId: A.material, cantidad: 1, costoUnitario: 1 }] }],
  ];
  for (const [metodo, ruta, body] of intentos) {
    const { status, texto } = await llamar(metodo, ruta, body);
    if (process.env.DEBUG_AISLAMIENTO) console.log(status, metodo, ruta, texto.slice(0, 120));
    assert.ok(status >= 400, `${metodo} ${ruta} respondio ${status}: ${texto.slice(0, 200)}`);
    assert.ok(!texto.includes(MARCA_B), `${metodo} ${ruta} filtra datos de B`);
  }
  assert.equal(await selloB(), antes, "algun intento modifico datos de B");
});

test("los Excel exportados por A sin filtro de obra no traen datos de B", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const tipos = [
    "avances", "asistencias-obra", "asistencias-persona", "general-equipo", "presupuesto-vs-real",
    "materiales-remision", "herramientas", "costos-obra", "transacciones",
  ];
  let conDatosA = 0;
  for (const tipo of tipos) {
    const res = await fetch(`${base}/api/reportes/${tipo}/exportar`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}`, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 200, `${tipo} respondio ${res.status}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as never);
    const celdas: string[] = [];
    wb.eachSheet((hoja) => hoja.eachRow((fila) => fila.eachCell((c) => celdas.push(String(c.value ?? "")))));
    if (celdas.some((c) => c.includes("EMPRESA-A"))) conDatosA++;
    assert.ok(!celdas.some((c) => c.includes(MARCA_B)), `${tipo} incluye datos de B`);
  }
  // Control: si los Excel no traen ni los datos de A, la revision de arriba no probaria nada.
  assert.ok(conDatosA >= tipos.length / 2, `solo ${conDatosA} reportes traen datos de A`);
});

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler";
import { HttpError, requireAuth } from "../../middleware/auth";
import { requireSuperAdmin } from "../../middleware/superAdmin";
import { prisma } from "../../lib/prisma";
import { estadoCuenta, limitesDe } from "../../lib/plan";
import { uso } from "../../lib/limites";
import { writeAuditLog } from "../../lib/audit";
import { marketingParcialSchema } from "../../lib/marketing";
import { ROLES } from "../../lib/roles";
import { resumenTablero, tenantsInternos } from "./resumen";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireSuperAdmin);

type UsuarioMin = { email: string; activo: boolean; deletedAt: Date | null; createdAt: Date; ultimoLoginAt: Date | null; rol: { nombre: string } };

// El Administrador activo mas antiguo es el contacto de la empresa.
export function adminEmailDe(usuarios: UsuarioMin[]): string | null {
  const admins = usuarios.filter((u) => u.activo && !u.deletedAt && u.rol.nombre === ROLES.ADMIN).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return admins[0]?.email ?? null;
}

const ultimoAccesoDe = (usuarios: UsuarioMin[]) =>
  usuarios.reduce<Date | null>((max, u) => (u.ultimoLoginAt && (!max || u.ultimoLoginAt > max) ? u.ultimoLoginAt : max), null);

const usuariosSelect = { select: { email: true, activo: true, deletedAt: true, createdAt: true, ultimoLoginAt: true, rol: { select: { nombre: true } } } } as const;

// shortcut: sin paginar ni filtrar en el servidor; con cientos de empresas, paginar aqui.
adminRouter.get(
  "/empresas",
  asyncHandler(async (_req, res) => {
    const internos = await tenantsInternos();
    const tenants = await prisma.tenant.findMany({ where: { id: { notIn: internos } }, include: { usuarios: usuariosSelect }, orderBy: { createdAt: "desc" } });
    res.json({
      ...resumenTablero(tenants),
      empresas: tenants.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        giro: t.giro,
        canal: t.canal,
        plan: t.plan,
        estado: estadoCuenta(t),
        vigenteHasta: t.vigenteHasta,
        metodoPago: t.metodoPago,
        ultimoAcceso: ultimoAccesoDe(t.usuarios),
        adminEmail: adminEmailDe(t.usuarios),
        createdAt: t.createdAt,
      })),
    });
  })
);

const AVISO_STRIPE = "Esta empresa paga con Stripe; el cambio se revierte en su próximo cobro.";
const sinInfinito = (n: number) => (Number.isFinite(n) ? n : null);

// 404 tambien para las empresas internas: el panel no las administra.
async function empresaDe(id: string) {
  const t = await prisma.tenant.findUnique({ where: { id } });
  if (!t || (await tenantsInternos()).includes(t.id)) throw new HttpError(404, "Empresa no encontrada");
  return t;
}

adminRouter.get(
  "/empresas/:id",
  asyncHandler(async (req, res) => {
    const t = await empresaDe(req.params.id);
    const [usuarios, usado, logs] = await Promise.all([
      prisma.usuario.findMany({ where: { tenantId: t.id }, ...usuariosSelect }),
      uso(t.id),
      prisma.auditLog.findMany({ where: { tenantId: t.id, entidadTipo: "Tenant" }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const ids = [...new Set(logs.map((l) => l.usuarioId).filter((id) => id !== "stripe"))];
    const correos = new Map((await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
    const lim = limitesDe(t.plan);
    res.json({
      id: t.id,
      nombre: t.nombre,
      giro: t.giro,
      canal: t.canal,
      canalDetalle: t.canalDetalle,
      plan: t.plan,
      activo: t.activo,
      estado: estadoCuenta(t),
      vigenteHasta: t.vigenteHasta,
      metodoPago: t.metodoPago,
      origenPago: t.origenPago,
      primerPagoAt: t.primerPagoAt,
      tieneSuscripcion: Boolean(t.stripeSubscriptionId),
      createdAt: t.createdAt,
      adminEmail: adminEmailDe(usuarios),
      ultimoAcceso: ultimoAccesoDe(usuarios),
      uso: usado,
      limites: { obras: sinInfinito(lim.obras), usuarios: sinInfinito(lim.usuarios) },
      historial: logs.map((l) => ({
        accion: l.accion,
        fecha: l.createdAt,
        quien: l.usuarioId === "stripe" ? "stripe" : (correos.get(l.usuarioId) ?? l.usuarioId),
        cambios: l.cambios ? JSON.parse(l.cambios) : null,
      })),
    });
  })
);

const planSchema = z.enum(["basico", "profesional", "empresa", "piloto"]);

// "YYYY-MM-DD" real y futura; queda pagada hasta el final de ese dia (UTC).
const fechaFutura = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s, ctx) => {
    const d = new Date(`${s}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      ctx.addIssue({ code: "custom", message: "Fecha inválida" });
      return z.NEVER;
    }
    if (d <= new Date()) {
      ctx.addIssue({ code: "custom", message: "La fecha debe ser futura" });
      return z.NEVER;
    }
    return d;
  });

const pagoManualSchema = z.object({ plan: planSchema, hasta: fechaFutura, monto: z.number().min(0).optional(), nota: z.string().trim().max(300).optional() });

const registrar = (tenantId: string, usuarioId: string, accion: Parameters<typeof writeAuditLog>[0]["accion"], cambios: Record<string, unknown>) =>
  writeAuditLog({ tenantId, usuarioId, entidadTipo: "Tenant", entidadId: tenantId, accion, cambios });

adminRouter.post(
  "/empresas/:id/pago-manual",
  asyncHandler(async (req, res) => {
    const { plan, hasta, monto, nota } = pagoManualSchema.parse(req.body);
    const antes = await empresaDe(req.params.id);
    const despues = await prisma.tenant.update({
      where: { id: antes.id },
      data: { plan, vigenteHasta: hasta, origenPago: "manual", metodoPago: "manual", ...(antes.primerPagoAt ? {} : { primerPagoAt: new Date() }) },
    });
    await registrar(antes.id, req.user!.sub, "pago_manual", {
      antes: { plan: antes.plan, vigenteHasta: antes.vigenteHasta },
      despues: { plan: despues.plan, vigenteHasta: despues.vigenteHasta },
      monto: monto ?? null,
      nota: nota ?? null,
    });
    res.json({ ok: true, aviso: antes.stripeSubscriptionId ? AVISO_STRIPE : null });
  })
);

adminRouter.patch(
  "/empresas/:id/plan",
  asyncHandler(async (req, res) => {
    const { plan } = z.object({ plan: planSchema }).parse(req.body);
    const antes = await empresaDe(req.params.id);
    await prisma.tenant.update({ where: { id: antes.id }, data: { plan } });
    await registrar(antes.id, req.user!.sub, "cambiar_plan", { antes: { plan: antes.plan }, despues: { plan } });
    res.json({ ok: true, aviso: antes.stripeSubscriptionId ? AVISO_STRIPE : null });
  })
);

adminRouter.patch(
  "/empresas/:id/activo",
  asyncHandler(async (req, res) => {
    const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
    const antes = await empresaDe(req.params.id);
    await prisma.tenant.update({ where: { id: antes.id }, data: { activo } });
    await registrar(antes.id, req.user!.sub, activo ? "reactivar" : "suspender", { antes: { activo: antes.activo }, despues: { activo } });
    res.json({ ok: true });
  })
);

adminRouter.patch(
  "/empresas/:id/marketing",
  asyncHandler(async (req, res) => {
    const datos = marketingParcialSchema.parse(req.body);
    const antes = await empresaDe(req.params.id);
    await prisma.tenant.update({ where: { id: antes.id }, data: datos });
    await registrar(antes.id, req.user!.sub, "actualizar", {
      antes: { giro: antes.giro, canal: antes.canal, canalDetalle: antes.canalDetalle },
      despues: datos,
    });
    res.json({ ok: true });
  })
);

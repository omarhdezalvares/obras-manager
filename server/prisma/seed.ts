import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = ["Administrador", "Gerente de Proyecto", "Supervisor", "Oficial", "Finanzas", "Solo lectura"] as const;

const DEMO_PASSWORD = "obraos2026";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Sembrando datos de demo del piloto OBRA/OS...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "empresa-piloto" },
    update: {},
    create: { nombre: "Empresa Piloto S.A. de C.V.", slug: "empresa-piloto", plan: "piloto" },
  });

  const roles = new Map<string, string>();
  for (const nombre of ROLES) {
    const rol = await prisma.rol.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre } },
      update: {},
      create: { tenantId: tenant.id, nombre },
    });
    roles.set(nombre, rol.id);
  }

  // --- Personas + usuarios de acceso ---
  // Seccion 15: Edgar es el Administrador de la empresa piloto, dueno de la
  // linea base de Fase 0. Finanzas es una persona distinta desde el mes 1.
  const personasSeed = [
    { nombre: "Edgar Ramirez", puesto: "Administrador", tipo: "oficina", costo: 0, rol: "Administrador", email: "edgar@piloto.test" },
    { nombre: "Lucia Fernandez", puesto: "Gerente de Proyecto", tipo: "oficina", costo: 0, rol: "Gerente de Proyecto", email: "lucia@piloto.test" },
    { nombre: "Marco Duarte", puesto: "Supervisor de campo", tipo: "campo", costo: 650, rol: "Supervisor", email: "marco@piloto.test" },
    { nombre: "Ivan Salgado", puesto: "Oficial electricista", tipo: "campo", costo: 550, rol: "Oficial", email: "ivan@piloto.test" },
    { nombre: "Rosa Beltran", puesto: "Oficial redes y AV", tipo: "campo", costo: 580, rol: "Oficial", email: "rosa@piloto.test" },
    { nombre: "Karla Ponce", puesto: "Finanzas", tipo: "oficina", costo: 0, rol: "Finanzas", email: "karla@piloto.test" },
  ];

  const personaIdByEmail = new Map<string, string>();
  for (const p of personasSeed) {
    const persona = await prisma.persona.create({
      data: {
        tenantId: tenant.id,
        nombreCompleto: p.nombre,
        puesto: p.puesto,
        tipoTrabajador: p.tipo,
        costoDiario: p.costo,
      },
    });
    personaIdByEmail.set(p.email, persona.id);

    await prisma.usuario.create({
      data: {
        tenantId: tenant.id,
        email: p.email,
        passwordHash,
        rolId: roles.get(p.rol)!,
        personaId: persona.id,
      },
    });
  }

  // Un rol de "Solo lectura" para un stakeholder externo, sin persona de campo.
  await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      email: "auditoria@piloto.test",
      passwordHash,
      rolId: roles.get("Solo lectura")!,
    },
  });

  // --- Catalogo de materiales (electrico / AV / redes / TI) ---
  const materialesSeed = [
    { nombre: "Cable UTP Cat6 (caja 305m)", unidad: "caja", categoria: "redes" },
    { nombre: "Cable THHW 12 AWG", unidad: "metro", categoria: "electrico" },
    { nombre: "Conector RJ45 Cat6", unidad: "pieza", categoria: "redes" },
    { nombre: "Camara IP domo 4MP", unidad: "pieza", categoria: "video" },
    { nombre: "Bocina de techo 6W", unidad: "pieza", categoria: "audio" },
    { nombre: "Centro de carga 12 espacios", unidad: "pieza", categoria: "electrico" },
  ];
  const materiales = [];
  for (const m of materialesSeed) {
    materiales.push(await prisma.material.create({ data: { tenantId: tenant.id, ...m } }));
  }

  // --- Herramientas ---
  const herramientasSeed = [
    { codigo: "HRM-001", nombre: "Multimetro Fluke 117", marca: "Fluke" },
    { codigo: "HRM-002", nombre: "Ponchadora RJ45", marca: "Klein Tools" },
    { codigo: "HRM-003", nombre: "Certificador de cableado", marca: "Fluke" },
    { codigo: "HRM-004", nombre: "Taladro rotomartillo", marca: "DeWalt" },
  ];
  const herramientas = [];
  for (const h of herramientasSeed) {
    herramientas.push(await prisma.herramienta.create({ data: { tenantId: tenant.id, ...h, estado: "disponible" } }));
  }

  // --- Obras (replica el flujo 1 de la seccion 08: obra + partida GEN + transaccion presupuesto_inicial) ---
  async function crearObra(opts: {
    nombre: string;
    cliente: string;
    ubicacion: string;
    responsableId: string;
    presupuesto: number;
    estado: string;
  }) {
    const obra = await prisma.obra.create({
      data: {
        tenantId: tenant.id,
        nombre: opts.nombre,
        cliente: opts.cliente,
        ubicacion: opts.ubicacion,
        responsableId: opts.responsableId,
        presupuestoAutorizado: opts.presupuesto,
        estado: opts.estado,
        fechaInicio: daysAgo(20),
      },
    });
    const partidaGeneral = await prisma.partidaPresupuestal.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        codigo: "GEN",
        nombre: "General",
        tipo: "general",
        presupuestoInicial: opts.presupuesto,
        presupuestoActualizado: opts.presupuesto,
      },
    });
    await prisma.transaccion.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        partidaId: partidaGeneral.id,
        tipo: "presupuesto_inicial",
        monto: opts.presupuesto,
        registradoPor: opts.responsableId,
        descripcion: "Presupuesto autorizado inicial de la obra",
      },
    });

    const partidaManoObra = await prisma.partidaPresupuestal.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        codigo: "MO",
        nombre: "Mano de obra",
        tipo: "mano_obra",
        presupuestoInicial: opts.presupuesto * 0.4,
        presupuestoActualizado: opts.presupuesto * 0.4,
      },
    });
    await prisma.transaccion.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        partidaId: partidaManoObra.id,
        tipo: "presupuesto_inicial",
        monto: opts.presupuesto * 0.4,
        registradoPor: opts.responsableId,
        descripcion: 'Presupuesto inicial de partida "Mano de obra"',
      },
    });

    const partidaMaterial = await prisma.partidaPresupuestal.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        codigo: "MAT",
        nombre: "Materiales",
        tipo: "material",
        presupuestoInicial: opts.presupuesto * 0.5,
        presupuestoActualizado: opts.presupuesto * 0.5,
      },
    });
    await prisma.transaccion.create({
      data: {
        tenantId: tenant.id,
        obraId: obra.id,
        partidaId: partidaMaterial.id,
        tipo: "presupuesto_inicial",
        monto: opts.presupuesto * 0.5,
        registradoPor: opts.responsableId,
        descripcion: 'Presupuesto inicial de partida "Materiales"',
      },
    });

    return { obra, partidaGeneral, partidaManoObra, partidaMaterial };
  }

  const edgarId = personaIdByEmail.get("edgar@piloto.test")!;
  const luciaId = personaIdByEmail.get("lucia@piloto.test")!;
  const marcoId = personaIdByEmail.get("marco@piloto.test")!;
  const ivanId = personaIdByEmail.get("ivan@piloto.test")!;
  const rosaId = personaIdByEmail.get("rosa@piloto.test")!;

  const obraA = await crearObra({
    nombre: "Cableado estructurado - Torre Norte",
    cliente: "Corporativo Alfa",
    ubicacion: "Av. Reforma 123, CDMX",
    responsableId: luciaId,
    presupuesto: 180000,
    estado: "en_ejecucion",
  });

  const obraB = await crearObra({
    nombre: "CCTV y control de acceso - Planta 2",
    cliente: "Manufacturas Beta",
    ubicacion: "Parque Industrial Norte, Monterrey",
    responsableId: luciaId,
    presupuesto: 120000,
    estado: "en_ejecucion",
  });

  await crearObra({
    nombre: "Red WiFi corporativa - Oficinas Centrales",
    cliente: "Grupo Gamma",
    ubicacion: "Blvd. Constitucion 45, Queretaro",
    responsableId: edgarId,
    presupuesto: 60000,
    estado: "planeada",
  });

  // --- Asignacion de personas a obra (obra_personas), con override de costo en obraB ---
  async function asignar(obraId: string, personaId: string, rolEnObra: string, costoDiarioObra?: number) {
    await prisma.obraPersona.create({
      data: { tenantId: tenant.id, obraId, personaId, rolEnObra, costoDiarioObra },
    });
  }

  await asignar(obraA.obra.id, marcoId, "Supervisor");
  await asignar(obraA.obra.id, ivanId, "Oficial electricista");
  await asignar(obraA.obra.id, rosaId, "Oficial redes");

  // Costo por proyecto: Ivan gana mas en obraB (fuera de su plaza habitual).
  await asignar(obraB.obra.id, marcoId, "Supervisor");
  await asignar(obraB.obra.id, ivanId, "Oficial electricista", 700);

  // --- Asistencias + transacciones automaticas de los ultimos dias (obraA) ---
  async function registrarAsistencia(obraId: string, personaId: string, partidaManoObraId: string, fecha: Date, costo: number) {
    const asistencia = await prisma.asistencia.create({
      data: {
        tenantId: tenant.id,
        obraId,
        personaId,
        fecha,
        horaLlegada: "07:45",
        registradoPor: personaId,
      },
    });
    await prisma.transaccion.create({
      data: {
        tenantId: tenant.id,
        obraId,
        partidaId: partidaManoObraId,
        tipo: "costo_mano_obra",
        monto: costo,
        personaId,
        asistenciaId: asistencia.id,
        registradoPor: personaId,
        descripcion: "Costo de mano de obra (dato de demo)",
      },
    });
    return asistencia;
  }

  for (let dia = 4; dia >= 1; dia--) {
    const fecha = daysAgo(dia);
    await registrarAsistencia(obraA.obra.id, marcoId, obraA.partidaManoObra.id, fecha, 650);
    await registrarAsistencia(obraA.obra.id, ivanId, obraA.partidaManoObra.id, fecha, 550);
    const asistenciaRosa = await registrarAsistencia(obraA.obra.id, rosaId, obraA.partidaManoObra.id, fecha, 580);

    const avance = await prisma.avance.create({
      data: {
        tenantId: tenant.id,
        obraId: obraA.obra.id,
        fecha,
        descripcion: "Tendido de cableado en piso 3, canalizacion terminada en 2 de 4 alas.",
        registradoPor: rosaId,
      },
    });
    await prisma.avancePersona.create({
      data: { avanceId: avance.id, personaId: rosaId, asistenciaId: asistenciaRosa.id },
    });
  }

  // Un dia con costo por proyecto en obraB para Ivan.
  const asistenciaForanea = await prisma.asistencia.create({
    data: { tenantId: tenant.id, obraId: obraB.obra.id, personaId: ivanId, fecha: daysAgo(1), horaLlegada: "08:00", registradoPor: ivanId },
  });
  await prisma.transaccion.create({
    data: {
      tenantId: tenant.id,
      obraId: obraB.obra.id,
      partidaId: obraB.partidaManoObra.id,
      tipo: "costo_mano_obra",
      monto: 700,
      personaId: ivanId,
      asistenciaId: asistenciaForanea.id,
      registradoPor: ivanId,
      descripcion: "Costo de mano de obra con costo por proyecto",
    },
  });

  // --- Remision de materiales (obraA) ---
  const remision = await prisma.remision.create({
    data: {
      tenantId: tenant.id,
      obraId: obraA.obra.id,
      partidaId: obraA.partidaMaterial.id,
      proveedor: "Distribuidora Electrica del Norte",
      folio: "F-2026-0341",
      fecha: daysAgo(2),
      costoTotal: 305 * 4.5 + 1200 * 3.2,
      registradoPor: edgarId,
    },
  });
  await prisma.remisionMaterial.createMany({
    data: [
      { remisionId: remision.id, materialId: materiales[0].id, cantidad: 4.5, costoUnitario: 305, costoTotal: 305 * 4.5 },
      { remisionId: remision.id, materialId: materiales[2].id, cantidad: 3.2, costoUnitario: 1200, costoTotal: 1200 * 3.2 },
    ],
  });
  await prisma.transaccion.create({
    data: {
      tenantId: tenant.id,
      obraId: obraA.obra.id,
      partidaId: obraA.partidaMaterial.id,
      tipo: "costo_material",
      monto: 305 * 4.5 + 1200 * 3.2,
      remisionId: remision.id,
      registradoPor: edgarId,
      descripcion: `Remision de material - proveedor Distribuidora Electrica del Norte - folio F-2026-0341`,
    },
  });

  // --- Herramientas asignadas ---
  await prisma.herramientaAsignacion.create({
    data: { tenantId: tenant.id, herramientaId: herramientas[0].id, personaId: ivanId, obraId: obraA.obra.id },
  });
  await prisma.herramienta.update({ where: { id: herramientas[0].id }, data: { estado: "asignada" } });

  await prisma.herramientaAsignacion.create({
    data: { tenantId: tenant.id, herramientaId: herramientas[1].id, personaId: rosaId, obraId: obraA.obra.id },
  });
  await prisma.herramienta.update({ where: { id: herramientas[1].id }, data: { estado: "asignada" } });

  // Custodio con nombre libre (no es una Persona registrada en el catalogo):
  // demuestra el campo de texto libre para custodia de herramientas.
  await prisma.herramientaAsignacion.create({
    data: {
      tenantId: tenant.id,
      herramientaId: herramientas[2].id,
      custodioNombre: "Contratista externo - Jorge Palacios",
      obraId: obraB.obra.id,
    },
  });
  await prisma.herramienta.update({ where: { id: herramientas[2].id }, data: { estado: "asignada" } });

  console.log("\nListo. Usuarios de prueba (misma contrasena para todos):");
  console.log(`  Contrasena: ${DEMO_PASSWORD}\n`);
  for (const p of personasSeed) {
    console.log(`  ${p.rol.padEnd(22)} ${p.email}`);
  }
  console.log(`  ${"Solo lectura".padEnd(22)} auditoria@piloto.test`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

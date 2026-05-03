import fs from 'fs';
import csv from 'csv-parser';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RUTAS DE TUS ARCHIVOS
const archivoPacientes = path.join(__dirname, 'pacientes_rows.csv');
const archivoDentalink = path.join(__dirname, '32d3fe6c1a7ffb3f3fb46565093eba2a_tratamientos_acciones_realizadas_2026-04-20_20_33_41.csv');

const pacientesMap = new Map();
const presupuestosMap = new Map();
const itemsParaSubir = [];

// Función para asegurar que el texto no rompa el CSV si tiene comillas o comas
const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

console.log("1️⃣ Leyendo la tabla de pacientes de Supabase...");
fs.createReadStream(archivoPacientes)
  .pipe(csv())
  .on('data', (row) => {
      // Guardamos en memoria: RUT -> ID de Supabase
      if (row.rut && row.id) {
          pacientesMap.set(row.rut.trim().toUpperCase(), row.id);
      }
  })
  .on('end', () => {
      console.log(`✅ Pacientes cargados: ${pacientesMap.size}`);
      procesarDentalink();
  });

function procesarDentalink() {
  console.log("2️⃣ Cruzando la agenda de Dentalink con tus pacientes...");
  fs.createReadStream(archivoDentalink)
    .pipe(csv())
    .on('data', (row) => {
        const rutOriginal = row['RUT Paciente'];
        const numTratamiento = row['# Tratamiento'];
        const nombrePlanCSV = row['Nombre Tratamiento'] || 'Plan General';
        const accionClinica = row['Accion'] || row['Acción'] || 'Tratamiento'; 

        if (!rutOriginal || !numTratamiento) return;

        const rutExacto = rutOriginal.trim().toUpperCase();
        const pacienteId = pacientesMap.get(rutExacto);

        if (!pacienteId) return; // Si el paciente no existe, lo saltamos silenciosamente

        // Si es la primera vez que vemos este # Tratamiento, le creamos su Presupuesto
        if (!presupuestosMap.has(numTratamiento)) {
            presupuestosMap.set(numTratamiento, {
                id: randomUUID(), // 🔑 Generamos el UUID único de Supabase localmente
                paciente_id: pacienteId,
                id_dentalink: numTratamiento,
                nombre_tratamiento: `${nombrePlanCSV} #${numTratamiento}`,
                estado: 'aceptado',
                aprobado: true
            });
        }

        const presupuesto = presupuestosMap.get(numTratamiento);

        // Guardamos la prestación asociada al UUID generado
        itemsParaSubir.push({
            presupuesto_id: presupuesto.id,
            observacion: accionClinica,
            estado: 'realizado',
            abonado: 0,
            precio_pactado: 0
        });
    })
    .on('end', () => {
         crearCSVsFinales();
    });
}

function crearCSVsFinales() {
    console.log("3️⃣ Escribiendo los nuevos archivos listos para Supabase...");
    
    // 1. Archivo de Presupuestos
    const presupuestosHeaders = "id,paciente_id,id_dentalink,nombre_tratamiento,estado,aprobado\n";
    const presupuestosRows = Array.from(presupuestosMap.values()).map(p => 
        `${p.id},${p.paciente_id},${p.id_dentalink},${escapeCSV(p.nombre_tratamiento)},${escapeCSV(p.estado)},${p.aprobado}`
    ).join("\n");
    
    fs.writeFileSync(path.join(__dirname, '1_SUBIR_presupuestos.csv'), presupuestosHeaders + presupuestosRows);

    // 2. Archivo de Items
    const itemsHeaders = "presupuesto_id,observacion,estado,abonado,precio_pactado\n";
    const itemsRows = itemsParaSubir.map(i => 
        `${i.presupuesto_id},${escapeCSV(i.observacion)},${escapeCSV(i.estado)},${i.abonado},${i.precio_pactado}`
    ).join("\n");
    
    fs.writeFileSync(path.join(__dirname, '2_SUBIR_presupuesto_items.csv'), itemsHeaders + itemsRows);

    console.log(`\n🎉 ¡COMPLETADO EN 1 SEGUNDO!`);
    console.log(`👉 Presupuestos generados: ${presupuestosMap.size}`);
    console.log(`👉 Tratamientos generados: ${itemsParaSubir.length}`);
    console.log(`\nRevisa tu carpeta, tienes dos archivos nuevos listos para subir.`);
}
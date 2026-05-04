import fs from 'fs';
import csv from 'csv-parser';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RUTAS DE TUS ARCHIVOS (Verifica que el nombre coincida con tu CSV)
const archivoPacientes = path.join(__dirname, 'pacientes_rows.csv');
const archivoDentalink = path.join(__dirname, '32d3fe6c1a7ffb3f3fb46565093eba2a_tratamientos_acciones_realizadas_2026-04-20_20_33_41.csv');

const pacientesMap = new Map();
const presupuestosMap = new Map();
const itemsParaSubir = [];

const escapeCSV = (str) => {
    if (str === null || str === undefined) return "";
    return `"${String(str).replace(/"/g, '""')}"`;
};

console.log("1️⃣ Leyendo la tabla de pacientes...");
fs.createReadStream(archivoPacientes)
  .pipe(csv())
  .on('data', (row) => {
      if (row.rut && row.id) pacientesMap.set(row.rut.trim().toUpperCase(), row.id);
  })
  .on('end', () => {
      console.log(`✅ Pacientes cargados: ${pacientesMap.size}`);
      procesarDentalink();
  });

function procesarDentalink() {
  console.log("2️⃣ Procesando tratamientos y caras múltiples...");
  fs.createReadStream(archivoDentalink)
    .pipe(csv())
    .on('data', (row) => {
        const rutOriginal = row['RUT Paciente'];
        const numTratamiento = row['# Tratamiento'];
        const nombrePlanCSV = row['Nombre Tratamiento'] || 'Plan General';
        const accionClinica = row['Nombre Prestación'] || 'Tratamiento Genérico'; 

        if (!rutOriginal || !numTratamiento) return;

        const pacienteId = pacientesMap.get(rutOriginal.trim().toUpperCase());
        if (!pacienteId) return;

        const piezaRaw = row['Pieza Tratada'] || '';
        let dienteDetectado = '';
        let caraDetectada = '';
        let zonaDetectada = '';
        
        if (piezaRaw) {
            const partesPieza = piezaRaw.split(':');
            const posibleDiente = partesPieza[0] ? partesPieza[0].trim() : '';
            
            if (posibleDiente) {
                if (!isNaN(parseInt(posibleDiente)) && isFinite(posibleDiente)) {
                    dienteDetectado = parseInt(posibleDiente);
                } else {
                    zonaDetectada = posibleDiente;
                }
            }

            if (partesPieza[1]) {
                // Atrapa "v,o,m" -> VOM (y cambia Palatino por Lingual para estandarizar)
                caraDetectada = partesPieza[1].replace(/,/g, '').toUpperCase().replace(/P/g, 'L');
            }
        }

        // Filtro anti-errores de Dentalink (Ej: Ortodoncia en diente 17)
        const nombreLower = accionClinica.toLowerCase();
        if (nombreLower.includes("ortodoncia") || nombreLower.includes("contención") || nombreLower.includes("peeling") || nombreLower.includes("hialurónico") || nombreLower.includes("limpieza") || nombreLower.includes("destartraje") || nombreLower.includes("rx") || nombreLower.includes("vitaminas")) {
            dienteDetectado = '';
            zonaDetectada = zonaDetectada || 'General';
        }

        let observacionFinal = 'Plan General';
        if (caraDetectada) observacionFinal += ` | Cara: ${caraDetectada}`;
        if (zonaDetectada) observacionFinal += ` | Zona: ${zonaDetectada}`;

        if (!presupuestosMap.has(numTratamiento)) {
            presupuestosMap.set(numTratamiento, {
                id: randomUUID(), paciente_id: pacienteId, id_dentalink: numTratamiento,
                nombre_tratamiento: `${nombrePlanCSV} #${numTratamiento}`, estado: 'aceptado', aprobado: true
            });
        }

        itemsParaSubir.push({
            presupuesto_id: presupuestosMap.get(numTratamiento).id,
            nombre_prestacion: accionClinica,
            observacion: observacionFinal,
            estado: 'realizado', abonado: 0, precio_pactado: 0,
            diente_id: dienteDetectado || ''
        });
    })
    .on('end', () => crearCSVsFinales());
}

function crearCSVsFinales() {
    console.log("3️⃣ Creando CSVs finales...");
    const pHeaders = "id,paciente_id,id_dentalink,nombre_tratamiento,estado,aprobado\n";
    const pRows = Array.from(presupuestosMap.values()).map(p => `${p.id},${p.paciente_id},${p.id_dentalink},${escapeCSV(p.nombre_tratamiento)},${escapeCSV(p.estado)},${p.aprobado}`).join("\n");
    fs.writeFileSync(path.join(__dirname, '1_SUBIR_presupuestos.csv'), pHeaders + pRows);

    const iHeaders = "presupuesto_id,nombre_prestacion,observacion,estado,abonado,precio_pactado,diente_id\n";
    const iRows = itemsParaSubir.map(i => `${i.presupuesto_id},${escapeCSV(i.nombre_prestacion)},${escapeCSV(i.observacion)},${escapeCSV(i.estado)},${i.abonado},${i.precio_pactado},${i.diente_id}`).join("\n");
    fs.writeFileSync(path.join(__dirname, '2_SUBIR_presupuesto_items.csv'), iHeaders + iRows);
    console.log(`\n🎉 ¡Listo para subir a Supabase!`);
}
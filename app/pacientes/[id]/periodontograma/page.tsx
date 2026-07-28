'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Plus, Loader2, Save, Spline, Trash2, ChevronDown, LineChart
} from 'lucide-react'
import { toast } from 'sonner'


const DIENTES_SUPERIORES = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const DIENTES_INFERIORES = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ESTADOS_PIEZA = ['presente', 'ausente', 'implante'] as const;
const LABEL_COL_WIDTH = 176; // debe calzar EXACTO con w-44 de la tabla (11rem = 176px)
const TOOTH_WIDTH = 87;      // 3 columnas de 29px
const POINT_WIDTH = TOOTH_WIDTH / 3; // 29
const GAP_WIDTH = 20;    

const getInitialPiezaData = () => ({
  estado: 'presente',
  vestibular: {
    profundidad: [null, null, null],
    margen: [null, null, null],
    sangramiento: [false, false, false],
    exudado: [false, false, false],
  },
  palatino: {
    profundidad: [null, null, null],
    margen: [null, null, null],
    sangramiento: [false, false, false],
    exudado: [false, false, false],
  },
  lingual: {
    profundidad: [null, null, null],
    margen: [null, null, null],
    sangramiento: [false, false, false],
    exudado: [false, false, false],
  },
  furca: null,
  movilidad: null,
  anchuraEncia: null,
  placa: [false, false, false, false, false, false]
});


const normalizarPieza = (piezaData: any) => {
  const base = getInitialPiezaData();
  if (!piezaData) return base;


  const merged: any = { ...base, ...piezaData };


  (['vestibular', 'palatino', 'lingual'] as const).forEach((cara) => {
    const caraData = piezaData[cara] || {};
    let sangramiento = caraData.sangramiento;
    let exudado = caraData.exudado;


    if (!Array.isArray(sangramiento) || !Array.isArray(exudado)) {
      const legacySangrado = caraData.sangrado; // formato antiguo: 0=normal, 1=sangrado, 2=supuración
      if (Array.isArray(legacySangrado)) {
        sangramiento = [0, 1, 2].map((i) => legacySangrado[i] === 1);
        exudado = [0, 1, 2].map((i) => legacySangrado[i] === 2);
      } else {
        sangramiento = sangramiento || [false, false, false];
        exudado = exudado || [false, false, false];
      }
    }


    merged[cara] = {
      profundidad: caraData.profundidad || [null, null, null],
      margen: caraData.margen || [null, null, null],
      sangramiento,
      exudado,
    };
  });


  merged.estado = piezaData.estado || 'presente';
  merged.anchuraEncia = piezaData.anchuraEncia ?? null;


  return merged;
};


const normalizarDatos = (rawData: any) => {
  const result: Record<string, any> = {};
  Object.keys(rawData || {}).forEach((piezaStr) => {
    result[piezaStr] = normalizarPieza(rawData[piezaStr]);
  });
  return result;
};


// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN PARA GENERAR CURVAS SUAVES (Catmull-Rom a Bézier Cúbica)
// ─────────────────────────────────────────────────────────────────────────
const generarCurvaSuave = (puntos: { x: number, y: number }[], esContinuacion: boolean = false) => {
  if (puntos.length === 0) return '';
  if (puntos.length === 1) return `${esContinuacion ? 'L' : 'M'} ${puntos[0].x},${puntos[0].y}`;


  let path = `${esContinuacion ? 'L' : 'M'} ${puntos[0].x},${puntos[0].y}`;
 
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = i === 0 ? puntos[0] : puntos[i - 1];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = i + 2 < puntos.length ? puntos[i + 2] : p2;


    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;


    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
};


// ─────────────────────────────────────────────────────────────────────────
// GRÁFICO DE TENDENCIA (curvas de margen/profundidad)
// ─────────────────────────────────────────────────────────────────────────
const PeriodontogramaChart = ({ arcada, dientes, data }: { arcada: string, dientes: number[], data: any }) => {
  const isUpper = arcada === 'superior';
  const TOOTH_WIDTH = 86; // Escala aumentada
  const CHART_HEIGHT = 160;
  const MM_TO_PX = 5;
  const UAC_Y = CHART_HEIGHT / 2;


  const totalWidth = (dientes.length * TOOTH_WIDTH) + 20;


  const generatePath = (cara: 'vestibular' | 'palatino' | 'lingual', medida: 'margen' | 'profundidad') => {
    const segments: { x: number, y: number }[][] = [];
    let currentSegment: { x: number, y: number }[] = [];


    dientes.forEach((pieza, idx) => {
      const piezaData = data[pieza];
      const xBase = (idx * TOOTH_WIDTH) + (idx >= 8 ? 20 : 0);


      if (piezaData?.estado === 'ausente') {
        if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
        return;
      }


      const mediciones = piezaData?.[cara]?.[medida] || [null, null, null];
      mediciones.forEach((val: any, pointIdx: number) => {
        if (typeof val === 'number') {
          const x = xBase + (pointIdx * (TOOTH_WIDTH / 3)) + (TOOTH_WIDTH / 6);
          let y;
          if (medida === 'margen') {
            y = UAC_Y - (val * MM_TO_PX);
          } else {
            const margenVal = piezaData?.[cara]?.margen?.[pointIdx];
            if (typeof margenVal === 'number') {
              y = UAC_Y - ((margenVal - val) * MM_TO_PX);
            } else return;
          }
          currentSegment.push({ x, y });
        }
      });
    });

  if (currentSegment.length) segments.push(currentSegment);
    return segments.map(seg => generarCurvaSuave(seg)).join(' ');
  };


  const generatePocketArea = (cara: 'vestibular' | 'palatino' | 'lingual') => {
  const segments: { x: number, yMargen: number, yProf: number }[][] = [];
  let currentSegment: { x: number, yMargen: number, yProf: number }[] = [];
  let lastGlobalIndex: number | null = null;

  dientes.forEach((pieza, idx) => {
    const piezaData = data[pieza];
    if (piezaData?.estado === 'ausente') {
      if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
      lastGlobalIndex = null;
      return;
    }

    const margenData = piezaData?.[cara]?.margen || [null, null, null];
    const profData = piezaData?.[cara]?.profundidad || [null, null, null];
    const xBase = (idx * TOOTH_WIDTH) + (idx >= 8 ? 20 : 0);

    for (let pointIdx = 0; pointIdx < 3; pointIdx++) {
      const m = margenData[pointIdx];
      const p = profData[pointIdx];
      if (typeof m === 'number' && typeof p === 'number') {
        const globalIndex = idx * 3 + pointIdx;
        // Si hay más de 2 posiciones de distancia respecto al último punto pintado, cortamos el segmento
        if (lastGlobalIndex !== null && globalIndex - lastGlobalIndex > 2) {
          if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
        }
        const x = xBase + (pointIdx * (TOOTH_WIDTH / 3)) + (TOOTH_WIDTH / 6);
        const yMargen = UAC_Y - (m * MM_TO_PX);
        const yProf = UAC_Y - ((m - p) * MM_TO_PX);
        currentSegment.push({ x, yMargen, yProf });
        lastGlobalIndex = globalIndex;
      }
    }
  });

  if (currentSegment.length) segments.push(currentSegment);

  return segments.map(seg => {
    if (seg.length === 1) {
      const p = seg[0];
      const halfWidth = TOOTH_WIDTH / 6;
      return `M ${p.x},${p.yMargen} C ${p.x + halfWidth},${p.yMargen} ${p.x + halfWidth},${p.yProf} ${p.x},${p.yProf} C ${p.x - halfWidth},${p.yProf} ${p.x - halfWidth},${p.yMargen} ${p.x},${p.yMargen} Z`;
    }
    const topPoints = seg.map(p => ({ x: p.x, y: p.yMargen }));
    const bottomPoints = seg.map(p => ({ x: p.x, y: p.yProf })).reverse();
    const topPath = generarCurvaSuave(topPoints);
    const bottomPath = generarCurvaSuave(bottomPoints, true);
    return `${topPath} ${bottomPath} Z`;
  }).join(' ');
};



  const caraLingual = isUpper ? 'palatino' : 'lingual';
  const margenPathV = generatePath('vestibular', 'margen');
  const profundidadPathV = generatePath('vestibular', 'profundidad');
  const pocketAreaV = generatePocketArea('vestibular');
  const margenPathL = generatePath(caraLingual, 'margen');
  const profundidadPathL = generatePath(caraLingual, 'profundidad');
  const pocketAreaL = generatePocketArea(caraLingual);


  return (
    <div className="w-full my-6 overflow-x-auto custom-scrollbar">
      <div className="relative" style={{ width: totalWidth, height: CHART_HEIGHT }}>
        <svg width="100%" height="100%" className="absolute inset-0 z-0">
          {Array.from({ length: 15 }).map((_, i) => {
            const y = UAC_Y - ((7 - i) * MM_TO_PX);
            const isZeroLine = (7 - i) === 0;
            return <line key={`h-${i}`} x1="0" y1={y} x2="100%" y2={y} stroke={isZeroLine ? '#ef4444' : '#e2e8f0'} strokeWidth={isZeroLine ? 1.5 : 1} />;
          })}
          {dientes.map((pieza, idx) => {
            const x = (idx * TOOTH_WIDTH) + (idx >= 8 ? 20 : 0);
            const ausente = data[pieza]?.estado === 'ausente';
            return (
              <React.Fragment key={`v-${idx}`}>
                <line x1={x} y1="0" x2={x} y2="100%" stroke="#f1f5f9" strokeWidth="1" />
                {ausente && <rect x={x} y="0" width={TOOTH_WIDTH} height="100%" fill="#94a3b8" fillOpacity="0.15" />}
              </React.Fragment>
            );
          })}
          <line x1={8 * TOOTH_WIDTH} y1="0" x2={8 * TOOTH_WIDTH} y2="100%" stroke="#cbd5e1" strokeWidth="1" />
          <line x1={8 * TOOTH_WIDTH + 20} y1="0" x2={8 * TOOTH_WIDTH + 20} y2="100%" stroke="#cbd5e1" strokeWidth="1" />
        </svg>


        <svg width="100%" height="100%" className="absolute inset-0 z-10">
          <path d={pocketAreaV} fill="rgba(37, 99, 235, 0.15)" />
          <path d={margenPathV} stroke="#ef4444" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <path d={profundidadPathV} stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />


          <path d={pocketAreaL} fill="rgba(234, 179, 8, 0.15)" />
          <path d={margenPathL} stroke="#ca8a04" strokeWidth="2" fill="none" strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
          <path d={profundidadPathL} stroke="#a16207" strokeWidth="2" fill="none" strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────
// DIAGRAMA ANATÓMICO POR PIEZA (Escala ampliada)
// ─────────────────────────────────────────────────────────────────────────
const colorSeveridadBolsa = (profundidad: number | null | undefined) => {
  if (typeof profundidad !== 'number') return null;
  if (profundidad >= 6) return '#dc2626';
  if (profundidad >= 4) return '#eab308';
  return '#22c55e';
};


type TipoDiente = 'incisivo' | 'canino' | 'premolar' | 'molar';


const tipoDientePorFDI = (pieza: number): TipoDiente => {
  const ultimoDigito = pieza % 10;
  if (ultimoDigito === 3) return 'canino';
  if (ultimoDigito === 4 || ultimoDigito === 5) return 'premolar';
  if (ultimoDigito >= 6) return 'molar';
  return 'incisivo';
};


const generarDienteSVG = (tipo: TipoDiente, cx: number, baselineY: number, dir: 1 | -1) => {
  // Dimensiones aumentadas ~40% respecto a las originales
  const anchoCorona = tipo === 'molar' ? 44 : tipo === 'premolar' ? 32 : tipo === 'canino' ? 26 : 22;
  const altoCorona = tipo === 'molar' ? 28 : tipo === 'canino' ? 36 : 26;
  const altoRaiz = tipo === 'canino' ? 66 : tipo === 'molar' ? 52 : 46;


  const xL = cx - anchoCorona / 2;
  const xR = cx + anchoCorona / 2;
  const yNeck = baselineY;
  const yCoronaTope = baselineY - dir * altoCorona;
  const yRaizPunta = baselineY + dir * altoRaiz;
  const yRaizMedia = baselineY + dir * (altoRaiz * 0.55);


  let corona: string;
  if (tipo === 'molar') {
    const yCusp = baselineY - dir * (altoCorona * 0.6);
    corona =
      `M ${xL} ${yNeck} C ${xL} ${yCusp} ${xL + 4} ${yCoronaTope} ${cx - anchoCorona * 0.22} ${yCoronaTope} ` +
      `C ${cx - 7} ${yCoronaTope + dir * 4} ${cx + 7} ${yCoronaTope + dir * 4} ${cx + anchoCorona * 0.22} ${yCoronaTope} ` +
      `C ${xR - 4} ${yCoronaTope} ${xR} ${yCusp} ${xR} ${yNeck} Z`;
  } else if (tipo === 'canino') {
    corona = `M ${xL} ${yNeck} Q ${xL} ${yCoronaTope + dir * 12} ${cx} ${yCoronaTope} Q ${xR} ${yCoronaTope + dir * 12} ${xR} ${yNeck} Z`;
  } else {
    corona = `M ${xL} ${yNeck} Q ${xL} ${yCoronaTope} ${cx} ${yCoronaTope} Q ${xR} ${yCoronaTope} ${xR} ${yNeck} Z`;
  }


  const raices: string[] = [];
  if (tipo === 'molar') {
    const xM = cx - anchoCorona * 0.26;
    const xD = cx + anchoCorona * 0.26;
    raices.push(
      `M ${xL + 3} ${yNeck} Q ${xL} ${yRaizMedia} ${xM} ${yRaizPunta} L ${xM + 5} ${yRaizPunta} Q ${cx - 3} ${yRaizMedia} ${cx - 1} ${yNeck} Z`
    );
    raices.push(
      `M ${xR - 3} ${yNeck} Q ${xR} ${yRaizMedia} ${xD} ${yRaizPunta} L ${xD - 5} ${yRaizPunta} Q ${cx + 3} ${yRaizMedia} ${cx + 1} ${yNeck} Z`
    );
  } else {
    raices.push(
      `M ${xL + 3} ${yNeck} Q ${xL + 4} ${yRaizMedia} ${cx} ${yRaizPunta} Q ${xR - 4} ${yRaizMedia} ${xR - 3} ${yNeck} Z`
    );
  }


  return { corona, raices };
};


const generarAreaBolsaFila = (
  dientes: number[],
  data: any,
  cara: 'vestibular' | 'palatino' | 'lingual',
  dir: 1 | -1,
  baselineY: number,
  MM_TO_PX: number,
  TOOTH_WIDTH: number,
  offsetX: number = 0
) => {
  const segments: { x: number, yMargen: number, yProf: number }[][] = [];
  let currentSegment: { x: number, yMargen: number, yProf: number }[] = [];
  let lastGlobalIndex: number | null = null;

  dientes.forEach((pieza, idx) => {
    const piezaData = data[pieza];
    const estado = piezaData?.estado || 'presente';
    const cx = offsetX + (idx * TOOTH_WIDTH) + (idx >= 8 ? 20 : 0) + TOOTH_WIDTH / 2;

    if (estado === 'ausente') {
      if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
      lastGlobalIndex = null;
      return;
    }

    const caraData = piezaData?.[cara] || {};
    const margenArr = caraData.margen || [null, null, null];
    const profArr = caraData.profundidad || [null, null, null];
    const sangramientoArr = caraData.sangramiento || [false, false, false];
    const exudadoArr = caraData.exudado || [false, false, false];


    for (let i = 0; i < 3; i++) {
      const m = typeof margenArr[i] === 'number' ? margenArr[i] : 0;
      const p = profArr[i];
      if (typeof p === 'number') {
        const globalIndex = idx * 3 + i;
        if (lastGlobalIndex !== null && globalIndex - lastGlobalIndex > 2) {
          if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
        }
        const px = cx - (TOOTH_WIDTH * 0.28) + i * (TOOTH_WIDTH * 0.28);
        const yMargen = baselineY - dir * m * MM_TO_PX;
        const yProf = yMargen + dir * p * MM_TO_PX;
        currentSegment.push({ x: px, yMargen, yProf });
        lastGlobalIndex = globalIndex;
      }
    }
  });

  if (currentSegment.length) segments.push(currentSegment);

  return segments.map(seg => {
    if (seg.length === 1) {
      const p = seg[0];
      const halfWidth = TOOTH_WIDTH / 8;
      return `M ${p.x},${p.yMargen} C ${p.x + halfWidth},${p.yMargen} ${p.x + halfWidth},${p.yProf} ${p.x},${p.yProf} C ${p.x - halfWidth},${p.yProf} ${p.x - halfWidth},${p.yMargen} ${p.x},${p.yMargen} Z`;
    }
    const topPoints = seg.map(p => ({ x: p.x, y: p.yMargen }));
    const bottomPoints = seg.map(p => ({ x: p.x, y: p.yProf })).reverse();
    const topPath = generarCurvaSuave(topPoints);
    const bottomPath = generarCurvaSuave(bottomPoints, true);
    return `${topPath} ${bottomPath} Z`;
  }).join(' ');
};



const ESTILO_CARA: Record<'vestibular' | 'palatino' | 'lingual', {
  etiqueta: string; header: string; headerText: string; cardBorder: string; rowTint: string;
}> = {
  vestibular: { etiqueta: 'Vestibular', header: 'bg-blue-600', headerText: 'text-white', cardBorder: 'border-blue-200', rowTint: '#eff6ff' },
  palatino: { etiqueta: 'Palatino', header: 'bg-teal-600', headerText: 'text-white', cardBorder: 'border-teal-200', rowTint: '#f0fdfa' },
  lingual: { etiqueta: 'Lingual', header: 'bg-amber-500', headerText: 'text-white', cardBorder: 'border-amber-200', rowTint: '#fffbeb' },
};


const RULER_WIDTH = LABEL_COL_WIDTH;


const FilaDientesAnatomicos = ({
  dientes, data, cara, dir
}: {
  dientes: number[], data: any, cara: 'vestibular' | 'palatino' | 'lingual', dir: 1 | -1
}) => {
  const TOOTH_WIDTH = 86; // Escala ampliada (antes 66)
  const PANEL_HEIGHT = 220; // Espacio vertical ampliado (antes 150)
  const MM_TO_PX = 6; // Relación visual mayor
  const baselineY = dir === 1 ? 70 : PANEL_HEIGHT - 70;
  const totalWidth = RULER_WIDTH + (dientes.length * TOOTH_WIDTH) + 20;
  const estilo = ESTILO_CARA[cara];


  const areaBolsaPath = useMemo(
    () => generarAreaBolsaFila(dientes, data, cara, dir, baselineY, MM_TO_PX, TOOTH_WIDTH, RULER_WIDTH),
    [dientes, data, cara, dir, baselineY]
  );


  return (
    <div className={`w-full rounded-2xl border-2 ${estilo.cardBorder} overflow-hidden shadow-sm`}>
      <div className={`${estilo.header} ${estilo.headerText} px-4 py-1.5 flex items-center justify-between`}>
        <span className="text-[10px] font-black uppercase tracking-[0.15em]">{estilo.etiqueta}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-80">mm</span>
      </div>
      <div className="overflow-x-auto custom-scrollbar" style={{ background: estilo.rowTint }}>
        <svg width={totalWidth} height={PANEL_HEIGHT} className="block">
          {Array.from({ length: 16 }).map((_, i) => {
            const y = 16 + i * (MM_TO_PX * 2);
            return <line key={`g-${i}`} x1={RULER_WIDTH} y1={y} x2={totalWidth} y2={y} stroke="rgba(100,116,139,0.12)" strokeWidth="1" />;
          })}
          <line x1={RULER_WIDTH + 8 * TOOTH_WIDTH} y1="0" x2={RULER_WIDTH + 8 * TOOTH_WIDTH} y2={PANEL_HEIGHT} stroke="rgba(100,116,139,0.25)" strokeWidth="1" />
          <line x1={RULER_WIDTH + 8 * TOOTH_WIDTH + 20} y1="0" x2={RULER_WIDTH + 8 * TOOTH_WIDTH + 20} y2={PANEL_HEIGHT} stroke="rgba(100,116,139,0.25)" strokeWidth="1" />
          <line x1={RULER_WIDTH} y1="0" x2={RULER_WIDTH} y2={PANEL_HEIGHT} stroke="rgba(100,116,139,0.3)" strokeWidth="1" />
         
          {[0, 3, 6, 9].map((mm) => {
            const y = baselineY + dir * mm * MM_TO_PX;
            return (
              <g key={mm}>
                <line x1={RULER_WIDTH - 5} y1={y} x2={RULER_WIDTH} y2={y} stroke="#64748b" strokeWidth="1" />
                <text x={RULER_WIDTH - 8} y={y + 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#64748b">{mm}</text>
              </g>
            );
          })}
          <line x1={RULER_WIDTH} y1={baselineY} x2={totalWidth} y2={baselineY} stroke="#ef4444" strokeWidth="1.25" />


          {dientes.map((pieza, idx) => {
            const cx = RULER_WIDTH + (idx * TOOTH_WIDTH) + (idx >= 8 ? 20 : 0) + TOOTH_WIDTH / 2;
            const piezaData = data[pieza];
            const estado = piezaData?.estado || 'presente';
            const tipo = tipoDientePorFDI(pieza);


            if (estado === 'ausente') {
              const yA = baselineY - dir * 18;
              return (
                <ellipse
                  key={pieza}
                  cx={cx} cy={yA} rx={14} ry={12}
                  fill="none" stroke="#94a3b8" strokeDasharray="3 2" strokeWidth="1.25" opacity={0.6}
                />
              );
            }


            const { corona, raices } = generarDienteSVG(tipo, cx, baselineY, dir);
            const relleno = estado === 'implante' ? '#dbeafe' : '#ffffff';
            const trazo = estado === 'implante' ? '#3b82f6' : '#94a3b8';


           const caraData = piezaData?.[cara] || {};
            const margenArr = caraData.margen || [null, null, null];
            const profArr = caraData.profundidad || [null, null, null];
            const sangramientoArr = caraData.sangramiento || [false, false, false];
            const exudadoArr = caraData.exudado || [false, false, false];


            return (
              <g key={pieza}>
                {estado === 'implante' ? (
                  <g>
                    <rect x={cx - 4.5} y={Math.min(baselineY, baselineY + dir * 40)} width={9} height={40} fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.1" />
                    {[10, 20, 30].map((offset, i) => {
                      const y = baselineY + dir * offset;
                      return <line key={i} x1={cx - 4.5} y1={y} x2={cx + 4.5} y2={y} stroke="#3b82f6" strokeWidth="0.75" />;
                    })}
                  </g>
                ) : (
                  raices.map((r, i) => <path key={i} d={r} fill={relleno} stroke={trazo} strokeWidth="1" />)
                )}
                <path d={corona} fill={relleno} stroke={trazo} strokeWidth="1.25" />


                {[0, 1, 2].map((i) => {
                  const px = cx - (TOOTH_WIDTH * 0.28) + i * (TOOTH_WIDTH * 0.28);
                  const m = margenArr[i];
                  const p = profArr[i];
                  const tieneSangramiento = sangramientoArr[i] || false;
                  const tieneExudado = exudadoArr[i] || false;
                  const yM = typeof m === 'number' ? baselineY - dir * m * MM_TO_PX : baselineY;
                  const yP = (typeof p === 'number' && typeof m === 'number') ? yM + dir * p * MM_TO_PX : null;
                  const colorBolsa = colorSeveridadBolsa(p);
                  const hayRecesionOHiperplasia = typeof m === 'number' && m !== 0;


                  return (
                    <g key={i}>
                      {yP !== null && colorBolsa && (
                        <line x1={px} y1={yM} x2={px} y2={yP} stroke={colorBolsa} strokeWidth="2.5" strokeLinecap="round" />
                      )}
                      <circle cx={px} cy={yM} r="2.5" fill={hayRecesionOHiperplasia ? '#ef4444' : '#94a3b8'} />
                      {(tieneSangramiento || tieneExudado) && (
                        <circle
                          cx={px}
                          cy={yP !== null ? yP : yM}
                          r="3"
                          fill={tieneSangramiento ? '#ef4444' : '#f59e0b'}
                          stroke={tieneSangramiento && tieneExudado ? '#f59e0b' : 'white'}
                          strokeWidth={tieneSangramiento && tieneExudado ? '1.5' : '0.8'}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}


          {areaBolsaPath && (
            <path d={areaBolsaPath} fill="rgba(37, 99, 235, 0.32)" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.5" />
          )}
        </svg>
      </div>
    </div>
  );
};


const PeriodontogramaAnatomico = ({ arcada, dientes, data }: { arcada: string, dientes: number[], data: any }) => {
  const caraSecundaria: 'palatino' | 'lingual' = arcada === 'superior' ? 'palatino' : 'lingual';
  return (
    <div className="w-full my-2 space-y-3">
      <FilaDientesAnatomicos dientes={dientes} data={data} cara="vestibular" dir={1} />
      <FilaDientesAnatomicos dientes={dientes} data={data} cara={caraSecundaria} dir={-1} />
    </div>
  );
};


const PeriodontogramaTable = ({ arcada, cara, dientes, data, onDataChange }: any) => {
  const caraLabel = cara === 'palatino' ? 'Palatino' : cara === 'lingual' ? 'Lingual' : 'Vestibular';


  const handleTextChange = (pieza: number, medida: 'profundidad' | 'margen', indice: number, valor: string) => {
    if (valor === '' || valor === '-' || valor === '+') {
      onDataChange(pieza, cara, medida, indice, valor === '' ? null : valor);
      return;
    }
    const numValor = parseInt(valor, 10);
    if (isNaN(numValor)) return;
    if (medida === 'margen') {
      if (numValor < -9 || numValor > 9) return;
    } else {
      if (numValor < 0 || numValor > 15) return;
    }
    onDataChange(pieza, cara, medida, indice, numValor);
  };


  const handleFurcaChange = (pieza: number, valor: string) => {
    if (valor === '') return onDataChange(pieza, null, 'furca', null, null);
    const numValor = parseInt(valor, 10);
    if (isNaN(numValor) || numValor < 0 || numValor > 3) return;
    onDataChange(pieza, null, 'furca', null, numValor);
  };


  const handleMovilidadChange = (pieza: number, valor: string) => {
    if (valor === '' || valor === '-') {
      return onDataChange(pieza, null, 'movilidad', null, valor === '' ? null : valor);
    }
    const numValor = parseInt(valor, 10);
    if (isNaN(numValor) || numValor < -3 || numValor > 3) return;
    onDataChange(pieza, null, 'movilidad', null, numValor);
  };


  const handleAnchuraChange = (pieza: number, valor: string) => {
    if (valor === '') return onDataChange(pieza, null, 'anchuraEncia', null, null);
    const numValor = parseInt(valor, 10);
    if (isNaN(numValor) || numValor < 0 || numValor > 15) return;
    onDataChange(pieza, null, 'anchuraEncia', null, numValor);
  };


  const handleSangramientoChange = (pieza: number, indice: number) => {
    const actual = data[pieza]?.[cara]?.sangramiento?.[indice] || false;
    onDataChange(pieza, cara, 'sangramiento', indice, !actual);
  };


  const handleExudadoChange = (pieza: number, indice: number) => {
    const actual = data[pieza]?.[cara]?.exudado?.[indice] || false;
    onDataChange(pieza, cara, 'exudado', indice, !actual);
  };


  const handleEstadoClick = (pieza: number) => {
    const actual = data[pieza]?.estado || 'presente';
    const idx = ESTADOS_PIEZA.indexOf(actual as any);
    const siguiente = ESTADOS_PIEZA[(idx + 1) % ESTADOS_PIEZA.length];
    onDataChange(pieza, null, 'estado', null, siguiente);
  };


  const inputClass = "w-full h-8 text-center bg-transparent outline-none text-sm font-semibold transition-colors";


  return (
    <div className="w-full">
      <table
        className="border-collapse text-[10px]"
        style={{ tableLayout: 'fixed', width: LABEL_COL_WIDTH + dientes.length * TOOTH_WIDTH + GAP_WIDTH }}
      >
        <colgroup>
          <col style={{ width: LABEL_COL_WIDTH }} />
          {dientes.map((pieza: number, idx: number) => (
            <React.Fragment key={`col-${pieza}`}>
              <col style={{ width: POINT_WIDTH }} />
              <col style={{ width: POINT_WIDTH }} />
              <col style={{ width: POINT_WIDTH }} />
              {idx === 7 && <col style={{ width: GAP_WIDTH }} />}
            </React.Fragment>
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td className="font-bold text-slate-600 p-2 border border-slate-200 bg-slate-50 text-left w-44 shadow-sm align-bottom">
              # Pieza <span className="text-[9px] font-normal text-slate-400 ml-1">({caraLabel})</span>
            </td>
            {dientes.map((pieza: number, idx: number) => {
              const estado = data[pieza]?.estado || 'presente';
              return (
                <React.Fragment key={`head-${pieza}`}>
                  <td
                    colSpan={3}
                    onClick={() => handleEstadoClick(pieza)}
                    title="Click para marcar: presente → ausente → implante"
                    className={`text-center border border-slate-200 p-0 cursor-pointer select-none transition-colors
                      ${estado === 'ausente' ? 'bg-slate-100' : ''}
                      ${estado === 'implante' ? 'bg-blue-50/40' : ''}
                      ${estado === 'presente' ? 'bg-slate-50/40 hover:bg-slate-100' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center py-2.5">
                      <span className={`text-base font-black leading-none
                        ${estado === 'ausente' ? 'text-slate-400 line-through' : ''}
                        ${estado === 'implante' ? 'text-blue-600' : ''}
                        ${estado === 'presente' ? 'text-slate-600' : ''}
                      `}>
                        {pieza.toString().split('').join('.')}
                      </span>
                      {estado === 'implante' && <span className="text-[7px] font-black text-blue-500 mt-1">IMPLANTE</span>}
                      {estado === 'ausente' && <span className="text-[7px] font-black text-slate-400 mt-1">AUSENTE</span>}
                    </div>
                  </td>
                  {idx === 7 && <td className="min-w-[20px] max-w-[20px] border-none bg-transparent" rowSpan={8}></td>}
                </React.Fragment>
              );
            })}
          </tr>


          <tr>
            <td className="font-bold text-blue-600 p-2 border border-slate-200 text-left">Profundidad Surco</td>
            {dientes.map((pieza: number) => {
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <React.Fragment key={`prof-${pieza}`}>
                  {[0, 1, 2].map(i => {
                    const val = data[pieza]?.[cara]?.profundidad?.[i];
                    const isPatologica = typeof val === 'number' && val >= 4;
                    return (
                      <td key={`p-${pieza}-${i}`} className={`border border-slate-200 p-0 w-[28px] max-w-[28px] transition-colors ${ausente ? 'bg-slate-100' : 'bg-blue-50/30 hover:bg-blue-50'}`}>
                        <input
                          type="text" inputMode="numeric" disabled={ausente}
                          value={val !== null && val !== undefined ? val : ''}
                          onChange={(e) => handleTextChange(pieza, 'profundidad', i, e.target.value)}
                          className={`${inputClass} ${ausente ? 'cursor-not-allowed opacity-40' : 'cursor-text'} ${isPatologica ? 'text-red-600 font-black' : 'text-blue-600'} focus:bg-blue-100`}
                        />
                      </td>
                    )
                  })}
                </React.Fragment>
              );
            })}
          </tr>


          <tr>
            <td className="font-bold text-red-500 p-2 border border-slate-200 text-left">Margen</td>
            {dientes.map((pieza: number) => {
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <React.Fragment key={`marg-${pieza}`}>
                  {[0, 1, 2].map(i => {
                    const val = data[pieza]?.[cara]?.margen?.[i];
                    return (
                      <td key={`m-${pieza}-${i}`} className={`border border-slate-200 p-0 transition-colors ${ausente ? 'bg-slate-100' : 'bg-red-50/30 hover:bg-red-50'}`}>
                        <input
                          type="text" inputMode="numeric" disabled={ausente}
                          value={val !== null && val !== undefined ? val : ''}
                          onChange={(e) => handleTextChange(pieza, 'margen', i, e.target.value)}
                          className={`${inputClass} ${ausente ? 'cursor-not-allowed opacity-40' : 'cursor-text'} text-red-500 focus:bg-red-100`}
                        />
                      </td>
                    )
                  })}
                </React.Fragment>
              );
            })}
          </tr>


          <tr>
            <td className="font-bold text-slate-800 p-2 border border-slate-200 text-left bg-slate-50/30">NIC</td>
            {dientes.map((pieza: number) => (
              <React.Fragment key={`nic-${pieza}`}>
                {[0, 1, 2].map(i => {
                  const p = data[pieza]?.[cara]?.profundidad?.[i];
                  const m = data[pieza]?.[cara]?.margen?.[i];
                  let nicVal: string | number = '';
                  if (typeof p === 'number' && typeof m === 'number') nicVal = p - m;
                  const isHigh = typeof nicVal === 'number' && nicVal >= 4;
                  return (
                    <td key={`n-${pieza}-${i}`} className={`border border-slate-200 p-0 text-center align-middle font-bold bg-slate-50/30 h-8 text-base ${isHigh ? 'text-red-600' : 'text-slate-600'}`}>
                      {nicVal}
                    </td>
                  )
                })}
              </React.Fragment>
            ))}
          </tr>


          <tr>
            <td className="font-bold text-teal-600 p-2 border border-slate-200 text-left bg-teal-50/20">Anchura Encía Queratinizada</td>
            {dientes.map((pieza: number) => {
              const val = data[pieza]?.anchuraEncia;
              const ausente = data[pieza]?.estado === 'ausente';
              const isAbnormal = typeof val === 'number' && val < 3;
              return (
                <td key={`ae-${pieza}`} colSpan={3} className={`border border-slate-200 p-0 h-8 ${ausente ? 'bg-slate-100' : 'hover:bg-teal-50'}`}>
                  <input
                    type="text" inputMode="numeric" disabled={ausente}
                    value={val !== null && val !== undefined ? val : ''}
                    onChange={e => handleAnchuraChange(pieza, e.target.value)}
                    className={`${inputClass} ${ausente ? 'cursor-not-allowed opacity-40' : 'cursor-text'} ${isAbnormal ? 'text-red-600 font-black' : 'text-teal-700'} focus:bg-teal-100`}
                  />
                </td>
              )
            })}
          </tr>


          <tr>
            <td className="font-bold text-slate-600 p-2 border border-slate-200 text-left">Furca</td>
            {dientes.map((pieza: number) => {
              const val = data[pieza]?.furca;
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <td key={`furca-${pieza}`} colSpan={3} className={`border border-slate-200 p-0 h-8 ${ausente ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <input
                    type="text" inputMode="numeric" disabled={ausente}
                    value={val !== null && val !== undefined ? val : ''}
                    onChange={e => handleFurcaChange(pieza, e.target.value)}
                    className={`${inputClass} ${ausente ? 'cursor-not-allowed opacity-40' : 'cursor-text'} text-slate-600 focus:bg-slate-100`}
                  />
                </td>
              )
            })}
          </tr>


          <tr>
            <td className="font-bold text-red-600 p-2 border border-slate-200 text-left">
              Sangramiento
              <div className="text-[8px] font-normal text-slate-400 normal-case mt-0.5">click para activar/desactivar</div>
            </td>
            {dientes.map((pieza: number) => {
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <React.Fragment key={`sangram-${pieza}`}>
                  {[0, 1, 2].map(i => {
                    const activo = data[pieza]?.[cara]?.sangramiento?.[i] || false;
                    return (
                      <td
                        key={`sm-${pieza}-${i}`}
                        onClick={() => !ausente && handleSangramientoChange(pieza, i)}
                        className={`border border-slate-200 p-0 h-8 transition-colors ${ausente ? 'bg-slate-100 cursor-not-allowed opacity-40' : `cursor-pointer ${activo ? 'bg-red-500' : 'hover:bg-red-50'}`}`}
                      />
                    )
                  })}
                </React.Fragment>
              );
            })}
          </tr>


          <tr>
            <td className="font-bold text-amber-600 p-2 border border-slate-200 text-left">
              Exudado
              <div className="text-[8px] font-normal text-slate-400 normal-case mt-0.5">click para activar/desactivar</div>
            </td>
            {dientes.map((pieza: number) => {
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <React.Fragment key={`exud-${pieza}`}>
                  {[0, 1, 2].map(i => {
                    const activo = data[pieza]?.[cara]?.exudado?.[i] || false;
                    return (
                      <td
                        key={`ex-${pieza}-${i}`}
                        onClick={() => !ausente && handleExudadoChange(pieza, i)}
                        className={`border border-slate-200 p-0 h-8 transition-colors ${ausente ? 'bg-slate-100 cursor-not-allowed opacity-40' : `cursor-pointer ${activo ? 'bg-amber-400' : 'hover:bg-amber-50'}`}`}
                      />
                    )
                  })}
                </React.Fragment>
              );
            })}
          </tr>


          <tr>
            <td className="font-bold text-slate-600 p-2 border border-slate-200 text-left">Movilidad</td>
            {dientes.map((pieza: number) => {
              const val = data[pieza]?.movilidad;
              const ausente = data[pieza]?.estado === 'ausente';
              return (
                <td key={`mov-${pieza}`} colSpan={3} className={`border border-slate-200 p-0 h-8 ${ausente ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  <input
                    type="text" inputMode="numeric" disabled={ausente}
                    value={val !== null && val !== undefined ? val : ''}
                    onChange={e => handleMovilidadChange(pieza, e.target.value)}
                    className={`${inputClass} ${ausente ? 'cursor-not-allowed opacity-40' : 'cursor-text'} text-slate-600 focus:bg-slate-100`}
                  />
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};


export default function PeriodontogramaPage() {
  const params = useParams()
  const paciente_id = params.id as string
 
  const [historial, setHistorial] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<Record<string, any>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mostrarGrafico, setMostrarGrafico] = useState(false)


  useEffect(() => {
    if (paciente_id) {
      fetchHistorial()
    }
  }, [paciente_id])


  useEffect(() => {
    if (selectedId) {
      const examenSeleccionado = historial.find(h => h.id === selectedId);
      if (examenSeleccionado) {
        setData(normalizarDatos(examenSeleccionado.datos || {}));
      }
    } else if (historial.length > 0) {
      setSelectedId(historial[0].id);
      setData(normalizarDatos(historial[0].datos || {}));
    } else {
      crearNuevoExamen();
    }
  }, [selectedId, historial]);


  const fetchHistorial = async () => {
    setCargando(true);
    const { data: examenes, error } = await supabase
      .from('periodontogramas')
      .select('*')
      .eq('paciente_id', paciente_id)
      .order('fecha_examen', { ascending: false });


    if (error) {
      toast.error("Error al cargar el historial.");
      console.error(error);
    } else {
      setHistorial(examenes || []);
    }
    setCargando(false);
  };


  const crearNuevoExamen = () => {
    const nuevoId = 'nuevo-examen';
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nuevoExamen = { id: nuevoId, fecha_examen: fechaHoy, paciente_id: paciente_id, datos: {} };
    setHistorial(prev => [nuevoExamen, ...prev.filter(h => h.id !== nuevoId)]);
    setSelectedId(nuevoId);
    setData({});
  };


  const handleDataChange = (pieza: number, cara: string | null, medida: string, indice: number | null, valor: any) => {
    setData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const piezaStr = pieza.toString();


      if (!newData[piezaStr]) newData[piezaStr] = JSON.parse(JSON.stringify(getInitialPiezaData()));


      if (cara) {
        if (!newData[piezaStr][cara]) newData[piezaStr][cara] = {};
        if (indice !== null) {
          if (!newData[piezaStr][cara][medida]) newData[piezaStr][cara][medida] = [null, null, null];
          newData[piezaStr][cara][medida][indice] = valor;
        } else {
          newData[piezaStr][cara][medida] = valor;
        }
      } else {
        newData[piezaStr][medida] = valor;
      }
      return newData;
    });
  };


  const handleGuardar = async () => {
    if (!selectedId) return;
    setGuardando(true);


    const examenActual = historial.find(h => h.id === selectedId);
    if (!examenActual) {
      toast.error("No se encontró el examen a guardar.");
      setGuardando(false);
      return;
    }


    const payload = { paciente_id: paciente_id, fecha_examen: examenActual.fecha_examen, datos: data };
    let response;


    if (selectedId === 'nuevo-examen') {
      response = await supabase.from('periodontogramas').insert(payload).select().single();
    } else {
      response = await supabase.from('periodontogramas').update({ datos: data }).eq('id', selectedId).select().single();
    }


    if (response.error) {
      toast.error("Error al guardar.");
      console.error(response.error);
    } else {
      toast.success("Guardado con éxito.");
      await fetchHistorial();
      if (response.data) setSelectedId(response.data.id);
    }
    setGuardando(false);
  };
 
  const handleEliminar = async () => {
    if (!selectedId || selectedId === 'nuevo-examen') return toast.info("No se puede eliminar un examen no guardado.");
    if (!confirm("¿Eliminar este periodontograma? No se puede deshacer.")) return;

    setGuardando(true);
    const { error } = await supabase.from('periodontogramas').delete().eq('id', selectedId);
    if (error) {
      toast.error("Error al eliminar.");
    } else {
      toast.success("Eliminado.");
      setSelectedId(null);
      await fetchHistorial();
    }
    setGuardando(false);
  };


  if (cargando) return (
    <div className="h-96 flex flex-col items-center justify-center bg-white/50 rounded-[3rem] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando Periodontograma...</p>
    </div>
  )


  return (
    <div className="space-y-8 font-sans pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-3 leading-none">
            <Spline className="text-blue-600" size={24} />
            Periodontograma
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Historial Clínico del Paciente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGuardar} disabled={guardando} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-50">
            {guardando ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar
          </button>
          <button onClick={handleEliminar} disabled={guardando || !selectedId || selectedId === 'nuevo-examen'} className="bg-white text-red-500 border border-slate-200 px-4 py-3 rounded-xl font-black text-[11px] uppercase shadow-sm hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50">
            <Trash2 size={16} /> Eliminar
          </button>
        </div>
      </div>


      <div className="flex items-center gap-4 px-2">
        <div className="relative">
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="appearance-none bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 font-black text-xs uppercase text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer pr-12"
          >
            {historial.map(h => (
              <option key={h.id} value={h.id}>
                Examen del {new Date(h.fecha_examen + 'T00:00:00').toLocaleDateString('es-CL')} {h.id === 'nuevo-examen' ? '(Nuevo)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <button onClick={crearNuevoExamen} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-[11px] uppercase shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
          <Plus size={16} /> Nuevo Examen
        </button>
        <button onClick={() => setMostrarGrafico(!mostrarGrafico)} className={`border-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase shadow-sm transition-all flex items-center justify-center gap-2 ${mostrarGrafico ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
          <LineChart size={16} /> {mostrarGrafico ? 'Ocultar Tendencia' : 'Ver Tendencia'}
        </button>
      </div>


      <div className="flex flex-wrap items-center gap-4 px-4 text-[9px] font-bold uppercase text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> Bolsa ≤3mm</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block"></span> Bolsa 4-5mm</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-600 inline-block"></span> Bolsa ≥6mm</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Recesión/hiperplasia (margen)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span> Sangrado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span> Supuración</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block"></span> Pieza ausente</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400 inline-block"></span> Implante</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/40 inline-block"></span> Área de bolsa</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block"></span> Línea base (0mm)</span>
      </div>


      <div className="space-y-12">
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase mb-4 px-2">Maxilar Superior</h3>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-2">
            <PeriodontogramaTable arcada="superior" cara="vestibular" dientes={DIENTES_SUPERIORES} data={data} onDataChange={handleDataChange} />
            <PeriodontogramaAnatomico arcada="superior" dientes={DIENTES_SUPERIORES} data={data} />
            <PeriodontogramaTable arcada="superior" cara="palatino" dientes={DIENTES_SUPERIORES} data={data} onDataChange={handleDataChange} />
            {mostrarGrafico && <PeriodontogramaChart arcada="superior" dientes={DIENTES_SUPERIORES} data={data} />}
          </div>
        </div>


        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase mb-4 px-2">Maxilar Inferior</h3>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-2">
            <PeriodontogramaTable arcada="inferior" cara="vestibular" dientes={DIENTES_INFERIORES} data={data} onDataChange={handleDataChange} />
            <PeriodontogramaAnatomico arcada="inferior" dientes={DIENTES_INFERIORES} data={data} />
            <PeriodontogramaTable arcada="inferior" cara="lingual" dientes={DIENTES_INFERIORES} data={data} onDataChange={handleDataChange} />
            {mostrarGrafico && <PeriodontogramaChart arcada="inferior" dientes={DIENTES_INFERIORES} data={data} />}
          </div>
        </div>
      </div>
    </div>
  )
}

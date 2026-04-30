'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const c1 = [18, 17, 16, 15, 14, 13, 12, 11];
const c2 = [21, 22, 23, 24, 25, 26, 27, 28];
const c3 = [48, 47, 46, 45, 44, 43, 42, 41];
const c4 = [31, 32, 33, 34, 35, 36, 37, 38];

export default function OdontogramaMaestroPage() {
  const params = useParams()
  const pacienteId = params?.id as string
  const [dentadura, setDentadura] = useState<Record<string, any>>({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (pacienteId) fetchOdontograma()
  }, [pacienteId])

  async function fetchOdontograma() {
    try {
      setCargando(true)
      const { data } = await supabase.from('odontogramas').select('dentadura').eq('paciente_id', pacienteId).maybeSingle()
      if (data?.dentadura) setDentadura(data.dentadura)
    } catch (e) { console.error(e) } 
    finally { setCargando(false) }
  }

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronizando Ficha Clínica...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-10 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-8">
        <Link href={`/pacientes/${pacienteId}`} className="group inline-flex items-center gap-3 font-black text-[10px] text-slate-400 uppercase hover:text-blue-600 transition-all">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:bg-blue-50"><ChevronLeft size={16}/></div> 
          Volver a la ficha
        </Link>

        <section className="bg-white p-14 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden relative">
          {/* LEYENDA CON LOS LOGOS QUE TE GUSTAN */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-16 border-b border-slate-50 pb-10">
             <LegendItem color="bg-[#f43f5e]" label="Caries / Obturación" />
             <LegendItem color="bg-[#7dd3fc]" label="Restauración" />
             <LegendItem color="bg-[#a855f7]" label="Endodoncia" />
             <LegendItem color="bg-[#2563eb]" label="Corona" />
             <LegendItem color="bg-[#94a3b8]" label="Implante" />
             <LegendItem color="bg-[#1e293b]" label="Perno Muñón" />
             <LegendItem color="bg-[#f97316]" label="Fractura" />
             <LegendItem color="bg-[#facc15]" label="Infección Pulpar" />
             <LegendItem color="border-2 border-[#f43f5e]" label="Ausente / Extracción" />
          </div>

          <div className="flex flex-col items-center gap-24 py-10">
            <div className="flex gap-8">
              <div className="flex gap-2 border-r border-slate-100 pr-8">
                {c1.map(pid => <DienteConLogosExactos key={pid} id={pid} datos={dentadura[String(pid)] || {}} />)}
              </div>
              <div className="flex gap-2">
                {c2.map(pid => <DienteConLogosExactos key={pid} id={pid} datos={dentadura[String(pid)] || {}} />)}
              </div>
            </div>
            <div className="flex gap-8">
              <div className="flex gap-2 border-r border-slate-100 pr-8">
                {c3.map(pid => <DienteConLogosExactos key={pid} id={pid} datos={dentadura[String(pid)] || {}} invert />)}
              </div>
              <div className="flex gap-2">
                {c4.map(pid => <DienteConLogosExactos key={pid} id={pid} datos={dentadura[String(pid)] || {}} invert />)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DienteConLogosExactos({ id, datos = {}, invert = false }: any) {
  const isMolar = [18, 17, 16, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(id);

  // Mapeo de condiciones (Datos Planos de la BD)
  const isCaries = datos.caries === true;
  const isRestauracion = datos.restauracion === true;
  const isEndo = datos.endodoncia === true;
  const isAusente = datos.ausente === true || datos.extraccion === true;
  const isImplante = datos.implante === true;
  const isCorona = datos.corona === true || datos.protesis === true;
  const isPerno = datos.perno === true;
  const isFractura = datos.fractura === true;
  const isInfeccion = datos.infeccion === true;

  // Path exacto de tu otro odontograma
  const getDientePath = () => {
    if (isMolar) return "M20,20 L80,20 L85,80 Q85,100 50,100 Q15,100 15,80 Z";
    if ([12, 11, 21, 22, 31, 32, 41, 42].includes(id)) return "M35,20 L65,20 L68,85 Q68,100 50,100 Q32,100 32,85 Z";
    if ([13, 23, 33, 43].includes(id)) return "M35,30 L50,15 L65,30 L68,85 Q68,100 50,100 Q32,100 32,85 Z";
    return "M30,20 L70,20 L75,80 Q75,100 50,100 Q25,100 25,80 Z";
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${invert ? 'flex-col-reverse' : ''}`}>
      <span className="text-[9px] font-black text-slate-300 italic">{id}</span>
      <div className="relative w-14 h-18">
        <svg viewBox="0 0 100 120" className={`w-full h-full p-1 ${invert ? 'rotate-180' : ''}`}>
          {/* Silueta Base */}
          <path d={getDientePath()} fill="#fff" stroke={isCorona ? "#2563eb" : "#cbd5e1"} strokeWidth="2" />
          
          {/* 1. ENDODONCIA (Logo idéntico) */}
          {isEndo && (
            <path d="M50,25 L50,90" stroke="#a855f7" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
          )}

          {/* 2. CARIES (Logo idéntico) */}
          {isCaries && (
            <path d={isMolar ? "M25,35 L45,35 L45,65 L25,65 Z" : "M35,45 L50,45 L50,75 L35,75 Z"} fill="#f43f5e" />
          )}

          {/* 3. RESTAURACIÓN (Logo idéntico pero en celeste) */}
          {isRestauracion && (
            <path d={isMolar ? "M55,35 L75,35 L75,65 L55,65 Z" : "M50,45 L65,45 L65,75 L50,75 Z"} fill="#7dd3fc" />
          )}

          {/* 4. AUSENTE / EXTRACCIÓN (Logo idéntico: X doble) */}
          {isAusente && (
            <g stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" opacity="0.6">
              <line x1="10" y1="10" x2="90" y2="110" />
              <line x1="90" y1="10" x2="10" y2="110" />
            </g>
          )}

          {/* 5. IMPLANTE (Logo idéntico: Tornillo) */}
          {isImplante && (
            <g fill="#94a3b8">
              <rect x="40" y="70" width="20" height="40" rx="2" />
              <path d="M40,80 L60,80 M40,90 L60,90 M40,100 L60,100" stroke="white" strokeWidth="2" />
            </g>
          )}

          {/* 6. CORONA (Logo idéntico: Círculo punteado) */}
          {isCorona && (
            <circle cx="50" cy="35" r="45" fill="none" stroke="#2563eb" strokeWidth="5" strokeDasharray="8 4" />
          )}

          {/* 7. PERNO (Lógica de logo profesional) */}
          {isPerno && (
             <path d="M45,30 L55,30 L52,60 L48,60 Z" fill="#1e293b" />
          )}

          {/* 8. FRACTURA (Logo zigzag) */}
          {isFractura && (
            <path d="M20,40 L40,50 L30,60 L50,70" stroke="#f97316" strokeWidth="6" fill="none" strokeLinecap="round" />
          )}

          {/* 9. INFECCIÓN (Círculo en el ápice) */}
          {isInfeccion && (
            <circle cx="50" cy="110" r="10" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          )}
        </svg>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-50 shadow-sm">
      <div className={`w-3.5 h-3.5 rounded-full ${color}`}></div>
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
    </div>
  )
}
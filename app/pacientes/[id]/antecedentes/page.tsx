'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Plus, Trash2, Loader2, AlertTriangle, 
  Activity, Pill, Heart, CheckCircle2, X 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AntecedentesPage() {
  const { id } = useParams()
  const [cargando, setCargando] = useState(true)
  const [items, setItems] = useState<any[]>([])
  
  const OPCIONES_PREDEFINIDAS = {
    alerta: ['Alergia Amoxicilina', 'Alergica Amoxicilina Penicilina', 'Alergico a la primavera', 'Problemas al corazón', 'VIH'],
    medicamento: ['Amlodipino', 'Aspirina', 'Atenolol', 'Atorvastatina', 'Celebra', 'Enalapril', 'Fluoxetina', 'Furosemida', 'Iltuxam 20/5', 'Itulsap 25'],
    enfermedad: ['ACB', 'DIABETES', 'Fibromialgia', 'HPERTENSION', 'Resistencia a la Insulina', 'Sindrome Quino', 'Tiroide', 'VIH'],
    habito: ['Fumador', 'Alcohol ocasional', 'Sedentarismo', 'Higiene oral deficiente', 'Bruxismo']
  }

  useEffect(() => { 
    if (id) fetchAntecedentes() 
  }, [id])

  async function fetchAntecedentes() {
    const { data } = await supabase.from('antecedentes').select('*').eq('paciente_id', id)
    if (data) setItems(data)
    setCargando(false)
  }

  const toggleItem = async (categoria: string, contenido: string) => {
    const existe = items.find(i => i.categoria === categoria && i.contenido === contenido)
    if (existe) {
      await supabase.from('antecedentes').delete().eq('id', existe.id)
    } else {
      await supabase.from('antecedentes').insert([{ paciente_id: id, categoria, contenido }])
    }
    fetchAntecedentes()
  }

  const agregarPersonalizado = async (categoria: string, contenido: string) => {
    if (!contenido) return
    await supabase.from('antecedentes').insert([{ paciente_id: id, categoria, contenido }])
    fetchAntecedentes()
  }

  if (cargando) return (
    <div className="flex flex-col items-center justify-center p-40 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando Anamnesis...</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 text-left">
      {/* HEADER */}
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex items-center justify-between text-left">
          <div className="text-left">
            <h3 className="text-3xl font-black tracking-tighter text-slate-800 uppercase italic leading-none text-left">Anamnesis Médica</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 text-left">Ficha de riesgos sistémicos</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-3xl text-blue-600">
            <Activity size={32} />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        <SeccionDesplegable 
          titulo="Alertas Médicas" categoria="alerta" color="red"
          icon={<AlertTriangle size={20}/>}
          opciones={OPCIONES_PREDEFINIDAS.alerta}
          seleccionados={items.filter(i => i.categoria === 'alerta')}
          onToggle={toggleItem}
          onAddCustom={agregarPersonalizado}
        />

        <SeccionDesplegable 
          titulo="Enfermedades" categoria="enfermedad" color="blue"
          icon={<Activity size={20}/>}
          opciones={OPCIONES_PREDEFINIDAS.enfermedad}
          seleccionados={items.filter(i => i.categoria === 'enfermedad')}
          onToggle={toggleItem}
          onAddCustom={agregarPersonalizado}
        />

        <SeccionDesplegable 
          titulo="Medicamentos" categoria="medicamento" color="purple"
          icon={<Pill size={20}/>}
          opciones={OPCIONES_PREDEFINIDAS.medicamento}
          seleccionados={items.filter(i => i.categoria === 'medicamento')}
          onToggle={toggleItem}
          onAddCustom={agregarPersonalizado}
        />

        <SeccionDesplegable 
          titulo="Hábitos" categoria="habito" color="emerald"
          icon={<Heart size={20}/>}
          opciones={OPCIONES_PREDEFINIDAS.habito}
          seleccionados={items.filter(i => i.categoria === 'habito')}
          onToggle={toggleItem}
          onAddCustom={agregarPersonalizado}
        />
      </div>
    </div>
  )
}

// Sub-componente con tipos definidos para evitar errores de Build
function SeccionDesplegable({ titulo, categoria, icon, color, opciones, seleccionados, onToggle, onAddCustom }: any) {
  const [abierto, setAbierto] = useState(false)
  const [inputManual, setInputManual] = useState('')

  const colorMap: any = {
    red: 'bg-red-50 text-red-600 border-red-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  }

  return (
    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm relative h-full text-left">
      <div className="flex items-center justify-between mb-8 text-left">
        <div className="flex items-center gap-4 text-left">
          <div className={`p-4 rounded-[1.5rem] border ${colorMap[color]}`}>{icon}</div>
          <h4 className="font-black text-slate-800 uppercase italic text-lg tracking-tighter text-left">{titulo}</h4>
        </div>
        
        <button 
          onClick={() => setAbierto(!abierto)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${abierto ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
        >
          {abierto ? <X size={14}/> : <Plus size={14}/>}
          {abierto ? 'Cerrar' : 'Añadir'}
        </button>
      </div>

      {/* SELECTOR DE OPCIONES */}
      <AnimatePresence>
        {abierto && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-24 left-8 right-8 bg-slate-900 rounded-[2.5rem] p-8 z-50 shadow-2xl border border-slate-700 text-left"
          >
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 text-left">Selección Rápida</p>
            <div className="flex flex-wrap gap-2 mb-8 text-left">
              {opciones.map((opt: string) => {
                const isActive = (seleccionados as any[]).some((i: any) => i.contenido === opt)
                return (
                  <button 
                    key={opt}
                    onClick={() => onToggle(categoria, opt)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                      isActive 
                      ? 'bg-blue-600 text-white border-blue-500' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-slate-800 pt-6 text-left">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 text-left">Otro / Personalizado</p>
               <div className="flex gap-2 text-left">
                  <input 
                    type="text" 
                    placeholder="Escribir aquí..."
                    className="flex-1 bg-slate-800 p-4 rounded-xl text-xs font-bold text-white outline-none border border-slate-700 focus:border-blue-500"
                    value={inputManual}
                    onChange={(e) => setInputManual(e.target.value)}
                    onKeyDown={(e) => { 
                      if(e.key === 'Enter' && inputManual.trim()) { 
                        onAddCustom(categoria, inputManual); 
                        setInputManual(''); 
                      } 
                    }}
                  />
                  <button 
                    onClick={() => { 
                      if(inputManual.trim()) {
                        onAddCustom(categoria, inputManual); 
                        setInputManual(''); 
                      }
                    }}
                    className="bg-blue-600 text-white p-4 rounded-xl hover:bg-blue-500 transition-all"
                  >
                    <Plus size={18}/>
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ITEMS ACTUALES */}
      <div className="space-y-3 text-left">
        {(seleccionados as any[]).length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-slate-50 rounded-[2rem]">
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">No registra {titulo.toLowerCase()}</p>
          </div>
        ) : (
          (seleccionados as any[]).map((p: any) => (
            <div key={p.id} className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-2xl group border border-transparent hover:border-slate-200 transition-all text-left">
              <div className="flex items-center gap-3 text-left">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-tight text-left">{p.contenido}</span>
              </div>
              <button 
                onClick={() => onToggle(categoria, p.contenido)} 
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
              >
                <Trash2 size={14}/>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

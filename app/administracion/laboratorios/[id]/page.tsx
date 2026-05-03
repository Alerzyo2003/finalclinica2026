'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Beaker, MapPin, Phone, Edit3, Save, 
  CheckCircle2, XCircle, ChevronLeft, X, Loader2,
  BadgeDollarSign, FileText, Plus 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function DetalleLaboratorio() {
  const { id } = useParams()
  const [laboratorio, setLaboratorio] = useState<any>(null)
  const [prestaciones, setPrestaciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  // ESTADOS PARA NUEVA PRESTACIÓN
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nuevaPres, setNuevaPres] = useState({
    nombre_prestacion: '',
    costo_clinica: 0,
    precio_paciente: 0,
    abastecida: true
  })

  useEffect(() => {
    if (id) fetchDetalle()
  }, [id])

  async function fetchDetalle() {
    setCargando(true)
    try {
      const { data: lab } = await supabase.from('laboratorios').select('*').eq('id', id).single()
      const { data: pres } = await supabase.from('laboratorio_prestaciones').select('*').eq('laboratorio_id', id).order('nombre_prestacion')
      setLaboratorio(lab)
      setPrestaciones(pres || [])
    } catch (error) {
      console.error("Error al cargar detalle:", error)
    } finally {
      setCargando(false)
    }
  }

  const handleGuardarPrestacion = async () => {
    if (!nuevaPres.nombre_prestacion) return alert("El nombre es obligatorio")
    setGuardando(true)
    try {
      const { error } = await supabase.from('laboratorio_prestaciones').insert([{
        ...nuevaPres,
        laboratorio_id: id
      }])
      if (error) throw error
      
      setModalAbierto(false)
      setNuevaPres({ nombre_prestacion: '', costo_clinica: 0, precio_paciente: 0, abastecida: true })
      fetchDetalle()
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !laboratorio) return (
    <div className="flex flex-col items-center justify-center p-40 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Cargando catálogo...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <Link href="/administracion/laboratorios" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors font-black text-[10px] uppercase tracking-widest active:scale-95 w-fit">
          <ChevronLeft size={16}/> Volver a laboratorios
        </Link>

        {/* TÍTULO DE SECCIÓN ÚNICA */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
            Catálogo de Prestaciones
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PANEL DE INFORMACIÓN */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-8">
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Ficha del Proveedor</h3>
                <button className="text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={16}/></button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none">Nombre Comercial</label>
                  <p className="text-xl font-black text-slate-800 uppercase leading-tight mt-2">{laboratorio?.nombre}</p>
                </div>
                
                <div className="flex gap-4 items-start">
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400"><MapPin size={18}/></div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dirección</label>
                    <p className="text-xs font-bold text-slate-600 uppercase mt-1">{laboratorio?.direccion || 'No registrada'}</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400"><Phone size={18}/></div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                    <p className="text-xs font-bold text-slate-600 mt-1">{laboratorio?.telefono || 'Sin registro'}</p>
                  </div>
                </div>

                <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                  <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Especialidad</label>
                  <p className="text-[11px] font-bold text-slate-500 italic mt-2">"{laboratorio?.detalle}"</p>
                </div>
              </div>
            </div>
          </div>

          {/* LISTA DE PRESTACIONES */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicios Disponibles</h3>
                <button 
                  onClick={() => setModalAbierto(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-slate-900 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Plus size={14}/> Agregar Prestación
                </button>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[9px] font-black text-slate-300 uppercase">Estado</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-300 uppercase">Servicio</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-300 uppercase text-center">Costo</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-300 uppercase text-center">Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {prestaciones.length === 0 ? (
                    <tr><td colSpan={4} className="p-20 text-center text-[10px] font-bold text-slate-300 uppercase italic">No hay prestaciones registradas</td></tr>
                  ) : prestaciones.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-5">
                        {p.abastecida ? <CheckCircle2 size={16} className="text-emerald-500"/> : <XCircle size={16} className="text-slate-200"/>}
                      </td>
                      <td className="px-8 py-5 text-xs font-black text-slate-700 uppercase">{p.nombre_prestacion}</td>
                      <td className="px-8 py-5 text-xs font-bold text-red-400 text-center">${p.costo_clinica?.toLocaleString()}</td>
                      <td className="px-8 py-5 text-xs font-bold text-emerald-600 text-center">${p.precio_paciente?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL AGREGAR PRESTACIÓN */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-800 uppercase italic">Nueva Prestación</h3>
                <button onClick={() => setModalAbierto(false)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <X size={24}/>
                </button>
              </div>

              <div className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Nombre del Servicio</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Corona Zirconio"
                    className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    value={nuevaPres.nombre_prestacion}
                    onChange={(e) => setNuevaPres({...nuevaPres, nombre_prestacion: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Costo Clínica ($)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                      value={nuevaPres.costo_clinica}
                      onChange={(e) => setNuevaPres({...nuevaPres, costo_clinica: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Precio Venta ($)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                      value={nuevaPres.precio_paciente}
                      onChange={(e) => setNuevaPres({...nuevaPres, precio_paciente: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleGuardarPrestacion}
                  disabled={guardando}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-300"
                >
                  {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  Guardar Servicio
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Loader2, CheckCircle2, 
  XCircle, RefreshCw, AlertCircle, Plus, X, Save 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DetalleArancelPage() {
  const { categoria } = useParams()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  
  // Estados para el Modal de Nueva Prestación
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  
  const decodedCat = decodeURIComponent(categoria as string)

  // Formulario inicial
  const formInicial = {
    nombre_accion: '',
    codigo_accion: '',
    uco: '',
    precio: '',
    nombre_arancel: 'Arancel Base',
    id_accion_ext: '', // Para "ID Acción"
    icono_tipo: 'otro'
  }
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setCargando(true)
    const { data } = await supabase
      .from('prestaciones')
      .select('*')
      .eq('Nombre Categoria', decodedCat)
      .order('Nombre Accion', { ascending: true })
    
    setItems(data || [])
    setCargando(false)
  }

  // FUNCIÓN PARA CREAR NUEVA PRESTACIÓN
  async function handleCrearPrestacion() {
    if (!form.nombre_accion || !form.precio) return alert("Nombre y Precio son obligatorios")
    
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('prestaciones')
        .insert([{
          "Nombre": form.nombre_accion, // Usamos el nombre como base
          "Nombre Categoria": decodedCat,
          "Nombre Accion": form.nombre_accion,
          "Codigo Accion": form.codigo_accion,
          "UCO": parseFloat(form.uco) || 0,
          "Precio": parseInt(form.precio) || 0,
          "Nombre Arancel": form.nombre_arancel,
          "Habilitado": "si",
          "ID Acción": form.id_accion_ext,
          "icono_tipo": form.icono_tipo
        }])

      if (error) throw error

      setModalAbierto(false)
      setForm(formInicial)
      fetchItems() // Recargar lista
    } catch (err: any) {
      alert("Error al guardar: " + err.message)
    } finally {
      setGuardando(false)
    }
  }

  // FUNCIÓN PARA CAMBIAR ESTADO
  async function toggleEstado(id: string, estadoActual: string) {
    setActualizandoId(id)
    const valorLimpio = (estadoActual || "").trim().toLowerCase();
    const nuevoEstado = (valorLimpio === 'si' || valorLimpio === 'sí') ? 'no' : 'si';
    
    try {
      const { error } = await supabase
        .from('prestaciones')
        .update({ "Habilitado": nuevoEstado }) 
        .eq('id', id)

      if (error) throw error

      setItems(items.map(item => 
        item.id === id ? { ...item, Habilitado: nuevoEstado } : item
      ))
    } catch (err: any) {
      alert("Error al actualizar: " + err.message)
    } finally {
      setActualizandoId(null)
    }
  }

  if (cargando) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={40}/>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* NAVEGACIÓN */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase hover:text-blue-600 transition-colors group"
        >
          <div className="p-2 bg-white rounded-lg shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all border border-slate-100">
            <ArrowLeft size={14}/>
          </div>
          Volver a Categorías
        </button>

        {/* HEADER */}
        <header className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div>
             <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Arancel Clínico</span>
             <h1 className="text-4xl font-black text-slate-800 uppercase italic leading-none mt-4">{decodedCat}</h1>
           </div>
           <button 
            onClick={() => setModalAbierto(true)}
            className="bg-slate-900 text-white px-8 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95"
           >
             <Plus size={18} /> Nueva Acción
           </button>
        </header>

        {/* TABLA DE ACCIONES */}
        <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                  <th className="p-10">Tratamiento / Acción</th>
                  <th className="p-10 text-center">Estado</th>
                  <th className="p-10 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const valorNormalizado = (item.Habilitado || "").trim().toLowerCase();
                  const esSi = valorNormalizado === 'si' || valorNormalizado === 'sí';

                  return (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="p-10">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 uppercase italic group-hover:text-blue-600 transition-colors leading-tight">
                            {item["Nombre Accion"]}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                            Cod: {item["Codigo Accion"] || '---'}
                          </span>
                        </div>
                      </td>

                      <td className="p-10 text-center">
                        <button 
                          onClick={() => toggleEstado(item.id, item.Habilitado)}
                          disabled={actualizandoId === item.id}
                          className={`
                            relative inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm
                            ${esSi 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-red-50 text-red-500 border border-red-100'
                            }
                            ${actualizandoId === item.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                          `}
                        >
                          {actualizandoId === item.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : esSi ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {esSi ? 'Habilitado' : 'Deshabilitado'}
                        </button>
                      </td>

                      <td className="p-10 text-right font-black text-slate-900 text-xl tracking-tighter">
                        ${Number(item.Precio || 0).toLocaleString('es-CL')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL NUEVA PRESTACIÓN */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative border border-white/20 overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24}/>
              </button>
              
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">Añadir Acción</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-8">Categoría: {decodedCat}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre de la Acción Clínica</label>
                  <input 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="Ej: Obturación Resina Composite"
                    value={form.nombre_accion}
                    onChange={(e) => setForm({...form, nombre_accion: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Código Interno</label>
                  <input 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0101001"
                    value={form.codigo_accion}
                    onChange={(e) => setForm({...form, codigo_accion: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Precio ($)</label>
                  <input 
                    type="number"
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0"
                    value={form.precio}
                    onChange={(e) => setForm({...form, precio: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Valor UCO</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0.00"
                    value={form.uco}
                    onChange={(e) => setForm({...form, uco: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Icono en Odontograma</label>
                  <select 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none shadow-inner text-xs appearance-none"
                    value={form.icono_tipo}
                    onChange={(e) => setForm({...form, icono_tipo: e.target.value})}
                  >
                    <option value="otro">Punto General</option>
                    <option value="extraccion">Extracción (X)</option>
                    <option value="restauracion">Obturación (Círculo)</option>
                    <option value="endodoncia">Endodoncia (Línea)</option>
                    <option value="implante">Implante</option>
                    <option value="corona">Corona</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCrearPrestacion}
                disabled={guardando}
                className="w-full mt-10 bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200"
              >
                {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                {guardando ? 'Guardando...' : 'Guardar Prestación'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
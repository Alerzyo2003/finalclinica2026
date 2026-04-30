'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Beaker, Plus, Search, Ban, Loader2, X, Save, 
  MapPin, Phone, FileText 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function LaboratoriosPage() {
  const [laboratorios, setLaboratorios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  
  // ESTADOS PARA CREACIÓN
  const [modalCrear, setModalCrear] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nuevoLab, setNuevoLab] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    detalle: ''
  })

  useEffect(() => {
    fetchLaboratorios()
  }, [])

  async function fetchLaboratorios() {
    setCargando(true)
    const { data } = await supabase.from('laboratorios').select('*').order('nombre')
    if (data) setLaboratorios(data)
    setCargando(false)
  }

  const handleCrear = async () => {
    if (!nuevoLab.nombre) return alert("El nombre es obligatorio")
    setGuardando(true)
    try {
      const { error } = await supabase.from('laboratorios').insert([nuevoLab])
      if (error) throw error
      
      setModalCrear(false)
      setNuevoLab({ nombre: '', direccion: '', telefono: '', detalle: '' })
      fetchLaboratorios()
    } catch (error: any) {
      alert("Error al crear: " + error.message)
    } finally {
      setGuardando(false)
    }
  }

  const laboratoriosFiltrados = laboratorios.filter(lab => 
    lab.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-xl shadow-blue-100">
              <Beaker size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">Laboratorios</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 text-left">Gestión de proveedores externos</p>
            </div>
          </div>
          <button 
            onClick={() => setModalCrear(true)}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95 text-left"
          >
            <Plus size={18}/> Nuevo Laboratorio
          </button>
        </div>

        {/* BUSCADOR */}
        <div className="relative max-w-md text-left">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" placeholder="Buscar laboratorio..." 
            className="w-full bg-white p-5 pl-14 rounded-2xl shadow-sm text-sm font-bold outline-none border-none ring-1 ring-slate-100 focus:ring-2 ring-blue-500/20 transition-all text-slate-900"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden text-left">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Nombre</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Detalle / Servicios</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Por Pagar</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cargando ? (
                <tr><td colSpan={4} className="py-20 text-center text-left"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
              ) : laboratoriosFiltrados.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest italic text-left">No hay laboratorios registrados</td></tr>
              ) : laboratoriosFiltrados.map((lab) => (
                <tr key={lab.id} className="group hover:bg-slate-50/50 transition-all text-left">
                  <td className="px-10 py-6 text-left">
                    <Link href={`/administracion/laboratorios/${lab.id}`} className="text-sm font-black text-blue-600 uppercase hover:underline decoration-2 underline-offset-4 italic text-left">
                      {lab.nombre}
                    </Link>
                  </td>
                  <td className="px-10 py-6 text-[11px] font-bold text-slate-500 uppercase italic text-left">
                    {lab.detalle || 'Sin detalle'}
                  </td>
                  <td className="px-10 py-6 text-left">
                    <span className="text-sm font-black text-slate-800 text-left">$0</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 flex items-center gap-1 ml-auto text-left">
                      <Ban size={12}/> Deshabilitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA CREAR LABORATORIO */}
      <AnimatePresence>
        {modalCrear && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden text-left"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 text-left">
                <h3 className="text-xl font-black text-slate-800 uppercase italic text-left">Nuevo Laboratorio</h3>
                <button onClick={() => setModalCrear(false)} className="text-slate-300 hover:text-red-500 transition-colors text-left">
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 space-y-6 text-left">
                <Input label="Nombre del Laboratorio" value={nuevoLab.nombre} onChange={(v: any) => setNuevoLab({...nuevoLab, nombre: v})} />
                <Input label="Dirección" value={nuevoLab.direccion} icon={<MapPin size={14}/>} onChange={(v: any) => setNuevoLab({...nuevoLab, direccion: v})} />
                <Input label="Teléfono" value={nuevoLab.telefono} icon={<Phone size={14}/>} onChange={(v: any) => setNuevoLab({...nuevoLab, telefono: v})} />
                <Input label="Detalle (Ej: Prótesis, Carillas...)" value={nuevoLab.detalle} icon={<FileText size={14}/>} onChange={(v: any) => setNuevoLab({...nuevoLab, detalle: v})} />

                <button 
                  onClick={handleCrear}
                  disabled={guardando}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-300 text-left"
                >
                  {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  Registrar Laboratorio
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Input({ label, value, onChange, icon }: any) {
  return (
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic flex items-center gap-2 text-left">
        {icon} {label}
      </label>
      <input 
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 focus:bg-white transition-all shadow-inner text-slate-900"
      />
    </div>
  )
}

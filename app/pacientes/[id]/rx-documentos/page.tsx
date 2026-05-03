'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  FileText, Upload, Trash2, Loader2,
  X, Save, Calendar, FileType, Maximize2,
  ZoomIn, ZoomOut, RefreshCcw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'


export default function DocumentosPage() {
  const { id: paciente_id } = useParams()
  const [documentos, setDocumentos] = useState<any[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [cargando, setCargando] = useState(true)
 
  const [isMounted, setIsMounted] = useState(false)
 
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [editando, setEditando] = useState({ titulo: '', descripcion: '' })
  const [zoom, setZoom] = useState(1)


  useEffect(() => {
    setIsMounted(true)
    if (paciente_id) fetchDocumentos()
  }, [paciente_id])


  async function fetchDocumentos() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('documentos_pacientes')
        .select('*')
        .eq('paciente_id', paciente_id)
        .order('fecha_subida', { ascending: false })
     
      if (error) throw error
      if (data) setDocumentos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
   
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("No hay sesión activa")


      const fileExt = file.name.split('.').pop()
      const fileName = `${paciente_id}/${Date.now()}.${fileExt}`
     
      const { error: storageError } = await supabase.storage
        .from('pacientes_docs')
        .upload(fileName, file)
     
      if (storageError) throw new Error("Error en Storage")


      const { data: { publicUrl } } = supabase.storage.from('pacientes_docs').getPublicUrl(fileName)


      const { data, error: dbError } = await supabase.from('documentos_pacientes').insert([{
        paciente_id,
        nombre_archivo: file.name,
        url_archivo: publicUrl,
        tipo_archivo: file.type,
        titulo: file.name,
        profesional_id: user.id
      }]).select().single()


      if (dbError) throw new Error("Error en Base de Datos")


      if (data) {
        setDocumentos([data, ...documentos])
        abrirVisor(data)
        toast.success("Documento sincronizado")
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }


  const abrirVisor = (doc: any) => {
    setSeleccionado(doc)
    setEditando({ titulo: doc.titulo || doc.nombre_archivo, descripcion: doc.descripcion || '' })
    setZoom(1)
    setVisorAbierto(true)
  }


  const aumentarZoom = () => setZoom(prev => Math.min(prev + 0.5, 4))
  const disminuirZoom = () => setZoom(prev => Math.max(prev - 0.5, 1))
  const resetearZoom = () => setZoom(1)


  const guardarCambios = async () => {
    try {
      const { error } = await supabase
        .from('documentos_pacientes')
        .update({ titulo: editando.titulo, descripcion: editando.descripcion })
        .eq('id', seleccionado.id)
     
      if (error) throw error
      await fetchDocumentos()
      setVisorAbierto(false)
      toast.success("Información actualizada")
    } catch (err: any) {
      toast.error("Error al actualizar")
    }
  }


  const eliminarArchivo = async () => {
    if (typeof window !== 'undefined' && window.confirm("¿Eliminar archivo permanentemente?")) {
      try {
        const { error } = await supabase.from('documentos_pacientes').delete().eq('id', seleccionado.id)
        if (error) throw error
        setDocumentos(documentos.filter(d => d.id !== seleccionado.id))
        setVisorAbierto(false)
        toast.error("Archivo eliminado")
      } catch (err) {
        toast.error("Error al eliminar")
      }
    }
  }


  if (cargando) return (
    <div className="flex flex-col items-center justify-center p-40 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Accediendo al archivo...</p>
    </div>
  )


  return (
    <div className="max-w-7xl mx-auto p-6 pb-20 text-left">
      {/* HEADER */}
      <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex justify-between items-center mb-10 text-left">
        <div className="text-left">
          <h3 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">RX y Documentos</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 text-left">Expediente digital del paciente</p>
        </div>
        <label className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase cursor-pointer hover:bg-slate-900 shadow-xl transition-all flex items-center gap-2 active:scale-95 text-left">
          {subiendo ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18}/>}
          {subiendo ? 'Subiendo...' : 'Subir Documento'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={subiendo} />
        </label>
      </div>


      {/* GRILLA DE MINIATURAS ACTUALIZADA CON FECHA */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 text-left">
        {documentos.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest italic text-center">Sin registros digitalizados</p>
          </div>
        ) : (
          documentos.map((doc) => (
            <motion.div
              key={doc.id}
              whileHover={{ y: -5 }}
              onClick={() => abrirVisor(doc)}
              className="group cursor-pointer bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-blue-400 transition-all text-left"
            >
              <div className="aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden flex items-center justify-center relative">
                {(doc.tipo_archivo || '').includes('image') ? (
                  <img src={doc.url_archivo} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <FileText className="text-slate-200" size={40} />
                )}
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors flex items-center justify-center">
                   <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                </div>
              </div>
              <div className="px-1 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase truncate leading-tight">{doc.titulo || doc.nombre_archivo}</p>
                {/* FECHA AGREGADA AQUÍ */}
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tight">
                  {doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString('es-CL') : 'S/F'}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>


      {/* VISOR MODAL (PORTAL) */}
      {isMounted && createPortal(
        <AnimatePresence>
          {visorAbierto && seleccionado && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[99999] flex flex-col lg:flex-row overflow-hidden text-left"
            >
              {/* IZQUIERDA: VISUALIZADOR */}
              <div className="lg:w-[80%] w-full h-full relative flex items-center justify-center p-4 lg:p-12 overflow-hidden text-left">
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-3xl z-20 shadow-2xl">
                    <button onClick={disminuirZoom} className="p-3 text-white hover:bg-white/10 rounded-2xl transition-all"><ZoomOut size={20}/></button>
                    <div className="px-4 flex flex-col items-center">
                      <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{zoom.toFixed(1)}x</span>
                    </div>
                    <button onClick={aumentarZoom} className="p-3 text-white hover:bg-white/10 rounded-2xl transition-all"><ZoomIn size={20}/></button>
                    <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
                    <button onClick={resetearZoom} className="p-3 text-white hover:bg-white/10 rounded-2xl transition-all"><RefreshCcw size={18}/></button>
                  </div>


                  <button onClick={() => setVisorAbierto(false)} className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all z-20">
                    <X size={20} /> Salir del Visor
                  </button>


                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    {(seleccionado.tipo_archivo || '').includes('image') ? (
                      <motion.div
                        drag={zoom > 1}
                        dragMomentum={false}
                        animate={{ scale: zoom, x: zoom === 1 ? 0 : undefined, y: zoom === 1 ? 0 : undefined }}
                        className={zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                      >
                        <img src={seleccionado.url_archivo} referrerPolicy="no-referrer" className="max-w-full max-h-[85vh] object-contain rounded-sm select-none pointer-events-none shadow-2xl" draggable={false} />
                      </motion.div>
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                         <FileText size={120} className="text-white/10" />
                         <a href={seleccionado.url_archivo} target="_blank" rel="noopener noreferrer" className="bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-2xl hover:scale-105 transition-transform text-center">Abrir PDF en Nueva Pestaña</a>
                      </div>
                    )}
                  </div>
              </div>


              {/* DERECHA: PANEL TÉCNICO */}
              <motion.div initial={{ x: 100 }} animate={{ x: 0 }} exit={{ x: 100 }} className="lg:w-[20%] w-full bg-white h-full p-10 flex flex-col shadow-2xl z-30 text-left">
                <div className="flex-1 space-y-8 overflow-y-auto pr-2 text-left">
                  <div className="space-y-2 text-left">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 text-left"><FileType size={12}/> {seleccionado.tipo_archivo?.split('/')[1] || 'FILE'}</p>
                    <h4 className="text-xl font-black text-slate-800 leading-tight uppercase italic break-words text-left">{seleccionado.nombre_archivo}</h4>
                  </div>
                  <div className="pt-6 border-t border-slate-100 text-left">
                     <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 text-left"><Calendar size={14} /> {seleccionado.fecha_subida ? new Date(seleccionado.fecha_subida).toLocaleDateString() : 'S/F'}</p>
                  </div>
                  <div className="space-y-6 pt-10 text-left">
                    <div className="space-y-3 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic text-left">Título Visual</label>
                      <input type="text" className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold outline-none border-none text-slate-900 focus:ring-2 ring-blue-500/20" value={editando.titulo} onChange={(e) => setEditando({...editando, titulo: e.target.value})} />
                    </div>
                    <div className="space-y-3 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic text-left">Descripción / Hallazgos</label>
                      <textarea className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold outline-none border-none text-slate-900 focus:ring-2 ring-blue-500/20 min-h-[180px] resize-none" value={editando.descripcion} onChange={(e) => setEditando({...editando, descripcion: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="pt-8 space-y-3 text-left">
                  <button onClick={guardarCambios} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3"><Save size={18}/> Guardar Cambios</button>
                  <button onClick={eliminarArchivo} className="w-full bg-red-50 text-red-500 py-4 rounded-3xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"><Trash2 size={16}/> Eliminar Archivo</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}


      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  )
}


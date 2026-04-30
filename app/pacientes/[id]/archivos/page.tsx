'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  UploadCloud, ImageIcon, FileText, Trash2, 
  ExternalLink, Loader2, Plus, X, Search,
  Filter, Eye, Download
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function PacienteArchivosPage() {
  const { id } = useParams()
  const [archivos, setArchivos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [modalImagen, setModalImagen] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchArchivos()
  }, [id])

  async function fetchArchivos() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('documentos_pacientes')
        .select('*')
        .eq('paciente_id', id)
        .order('fecha_subida', { ascending: false })
      
      if (error) throw error
      setArchivos(data || [])
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
      // 1. Subir a Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}/${Date.now()}.${fileExt}`
      const { error: storageError } = await supabase.storage
        .from('documentos_pacientes')
        .upload(fileName, file)

      if (storageError) throw storageError

      // 2. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('documentos_pacientes')
        .getPublicUrl(fileName)

      // 3. Registrar en la tabla documentos_pacientes
      const { error: dbError } = await supabase
        .from('documentos_pacientes')
        .insert([{
          paciente_id: id,
          nombre_archivo: file.name,
          url_archivo: publicUrl,
          tipo_archivo: file.type,
          titulo: file.name.split('.')[0].toUpperCase()
        }])

      if (dbError) throw dbError

      toast.success("Archivo subido correctamente")
      fetchArchivos()
    } catch (error: any) {
      toast.error("Error al subir: " + error.message)
    } finally {
      setSubiendo(false)
    }
  }

  const eliminarArchivo = async (archivo: any) => {
    if (typeof window !== 'undefined') {
      if (!window.confirm("¿Deseas eliminar este archivo permanentemente?")) return
    }

    try {
      const path = archivo.url_archivo.split('documentos_pacientes/').pop()
      if (path) {
        await supabase.storage.from('documentos_pacientes').remove([path])
      }
      await supabase.from('documentos_pacientes').delete().eq('id', archivo.id)
      
      setArchivos(archivos.filter(a => a.id !== archivo.id))
      toast.success("Archivo eliminado")
    } catch (error) {
      toast.error("Error al eliminar")
    }
  }

  const archivosFiltrados = archivos.filter(a => 
    (a.titulo || '').toLowerCase().includes(filtro.toLowerCase()) ||
    (a.nombre_archivo || '').toLowerCase().includes(filtro.toLowerCase())
  )

  if (cargando) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando galería...</p>
    </div>
  )

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 text-left">
      {/* HEADER DE SECCIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div className="text-left">
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter text-left">Galería Multimedia</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-left">Gestión de Radiografías y Documentos</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 text-left">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar archivo..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 transition-all text-slate-900 shadow-inner border-none"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 transition-all flex items-center gap-2 shrink-0">
            {subiendo ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16}/>}
            {subiendo ? 'Subiendo...' : 'Subir Archivo'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={subiendo} accept="image/*,application/pdf" />
          </label>
        </div>
      </div>

      {/* GRID DE ARCHIVOS */}
      {archivosFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-left">
          <AnimatePresence>
            {archivosFiltrados.map((arc) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={arc.id}
                className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left"
              >
                {/* PREVIEW */}
                <div className="aspect-video bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  {(arc.tipo_archivo || '').includes('image') ? (
                    <img 
                      src={arc.url_archivo} 
                      alt={arc.titulo} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                      onClick={() => setModalImagen(arc.url_archivo)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={48} className="text-slate-200" />
                      <span className="text-[8px] font-black text-slate-300 uppercase">Documento PDF</span>
                    </div>
                  )}
                  
                  {/* OVERLAY ACTIONS */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                    {(arc.tipo_archivo || '').includes('image') && (
                      <button onClick={() => setModalImagen(arc.url_archivo)} className="p-3 bg-white rounded-xl text-slate-900 hover:bg-blue-600 hover:text-white transition-all">
                        <Eye size={18} />
                      </button>
                    )}
                    <a href={arc.url_archivo} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-xl text-slate-900 hover:bg-blue-600 hover:text-white transition-all">
                      <Download size={18} />
                    </a>
                    <button onClick={() => eliminarArchivo(arc)} className="p-3 bg-white rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* INFO */}
                <div className="p-5 text-left">
                  <h3 className="text-xs font-black text-slate-800 uppercase truncate mb-1 text-left">{arc.titulo || 'Sin título'}</h3>
                  <div className="flex justify-between items-center text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-left">
                      {arc.fecha_subida ? new Date(arc.fecha_subida).toLocaleDateString('es-CL') : 'S/F'}
                    </span>
                    <span className="text-[8px] px-2 py-0.5 bg-slate-100 rounded-md font-black text-slate-500 uppercase">
                      {arc.tipo_archivo?.split('/')[1] || 'FILE'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
          <div className="bg-white p-6 rounded-full shadow-sm mb-4 text-slate-200">
            <ImageIcon size={40} />
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">No hay archivos registrados</h3>
          <p className="text-xs text-slate-300 mt-2 text-center">Sube radiografías, fotos o exámenes del paciente.</p>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEN */}
      <AnimatePresence>
        {modalImagen && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
            onClick={() => setModalImagen(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-full"
            >
              <button className="absolute -top-12 right-0 text-white hover:text-blue-400 transition-colors">
                <X size={32} />
              </button>
              <img 
                src={modalImagen} 
                referrerPolicy="no-referrer"
                className="rounded-2xl shadow-2xl max-h-[85vh] object-contain" 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

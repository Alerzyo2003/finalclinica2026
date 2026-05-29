'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  FileText, Upload, Trash2, Loader2,
  X, Save, Calendar, FileType, Maximize2,
  ZoomIn, ZoomOut, RefreshCcw, Download,
  ListChecks, Check, Edit3
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function DocumentosPage() {
  const { id: paciente_id } = useParams()
  const [documentos, setDocumentos] = useState<any[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  
  // ESTADOS DEL VISOR INDIVIDUAL
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [editando, setEditando] = useState({ titulo: '', descripcion: '' })
  const [zoom, setZoom] = useState(1)

  // ESTADOS: SELECCIÓN MÚLTIPLE, RENOMBRADO Y DESCARGA EN BLOQUE
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionMultiples, setSeleccionMultiples] = useState<string[]>([])
  const [modalRenombrarAbierto, setModalRenombrarAbierto] = useState(false)
  const [datosRenombrar, setDatosRenombrar] = useState<{id: string, titulo: string, url: string, tipo: string}[]>([])

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

  // SUBIDA MÚLTIPLE DE ARCHIVOS
  const handleUploadMulti = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); // 🔥 CORREGIDO AQUÍ 🔥
    if (files.length === 0) return;
    setSubiendo(true);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("No hay sesión activa")

      let nuevosDocs = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${paciente_id}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`
        
        const { error: storageError } = await supabase.storage.from('pacientes_docs').upload(fileName, file)
        if (storageError) continue;

        const { data: { publicUrl } } = supabase.storage.from('pacientes_docs').getPublicUrl(fileName)

        const { data, error: dbError } = await supabase.from('documentos_pacientes').insert([{
          paciente_id,
          nombre_archivo: file.name,
          url_archivo: publicUrl,
          tipo_archivo: file.type,
          titulo: file.name,
          profesional_id: user.id
        }]).select().single()

        if (data && !dbError) nuevosDocs.push(data);
      }

      if (nuevosDocs.length > 0) {
        setDocumentos(prev => [...nuevosDocs, ...prev])
        toast.success(`Se subieron ${nuevosDocs.length} archivo(s) correctamente`)
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
    if (window.confirm("¿Eliminar archivo permanentemente?")) {
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

  // 🔥 FUNCIÓN CORREGIDA: DESCARGA MÚLTIPLE SECUENCIAL Y ROBUSTA 🔥
  const descargarMultiples = async () => {
    const toastId = toast.loading(`Preparando ${seleccionMultiples.length} descargas...`);
    const docsADescargar = seleccionMultiples
      .map(id => documentos.find(d => d.id === id))
      .filter(Boolean); // Filtra por si algún documento no se encuentra

    let descargasExitosas = 0;
    let descargasFallidas = 0;

    for (const doc of docsADescargar) {
      if (!doc) continue;
      try {
        // Usamos fetch para obtener el archivo como un 'blob'
        const response = await fetch(doc.url_archivo);
        if (!response.ok) throw new Error('La respuesta de la red no fue correcta.');
        const blob = await response.blob();

        // Creamos una URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.titulo || doc.nombre_archivo || 'documento_clinico';
        document.body.appendChild(link);
        link.click();
        
        // Limpiamos la URL y el elemento del DOM
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        descargasExitosas++;
        toast.loading(`Descargado ${descargasExitosas} de ${docsADescargar.length}: ${doc.titulo || doc.nombre_archivo}`, { id: toastId });

        // Una pequeña pausa entre cada descarga para no saturar el navegador
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error al descargar ${doc.nombre_archivo}:`, error);
        descargasFallidas++;
      }
    }

    if (descargasFallidas > 0) {
      toast.error(`${descargasFallidas} archivo(s) no se pudieron descargar.`, { id: toastId, duration: 5000 });
    } else {
      toast.success(`Se iniciaron ${descargasExitosas} descargas con éxito.`, { id: toastId, duration: 5000 });
    }

    setSeleccionMultiples([]);
    setModoSeleccion(false);
  }

  const eliminarMultiples = async () => {
    if (window.confirm(`¿Eliminar ${seleccionMultiples.length} archivos permanentemente?`)) {
       try {
          const { error } = await supabase.from('documentos_pacientes').delete().in('id', seleccionMultiples);
          if (error) throw error;
          setDocumentos(prev => prev.filter(d => !seleccionMultiples.includes(d.id)));
          setSeleccionMultiples([]);
          setModoSeleccion(false);
          toast.success("Archivos eliminados correctamente");
       } catch (err) {
          toast.error("Error al eliminar los archivos");
       }
    }
  }

  const guardarNombresMultiples = async () => {
    try {
       const toastId = toast.loading("Guardando nombres...");
       const promises = datosRenombrar.map(d => supabase.from('documentos_pacientes').update({titulo: d.titulo}).eq('id', d.id));
       await Promise.all(promises);
       
       await fetchDocumentos();
       setModalRenombrarAbierto(false);
       setSeleccionMultiples([]);
       setModoSeleccion(false);
       toast.success("Títulos actualizados con éxito", { id: toastId });
    } catch (err) {
       toast.error("Error al renombrar los archivos");
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
      <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 text-left">
        <div className="text-left">
          <h3 className="text-3xl font-black text-slate-800 uppercase italic leading-none">RX y Documentos</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Expediente digital del paciente</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => {
              setModoSeleccion(!modoSeleccion);
              if (modoSeleccion) setSeleccionMultiples([]);
            }} 
            className={`px-6 py-4 rounded-2xl font-black text-[11px] uppercase transition-all flex items-center gap-2 shadow-sm ${modoSeleccion ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {modoSeleccion ? <X size={18} /> : <ListChecks size={18}/>}
            {modoSeleccion ? 'Cancelar Selección' : 'Selección Múltiple'}
          </button>

          <label className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase cursor-pointer hover:bg-slate-900 shadow-xl transition-all flex items-center gap-2">
            {subiendo ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18}/>}
            {subiendo ? 'Subiendo...' : 'Subir Documento(s)'}
            <input type="file" multiple className="hidden" onChange={handleUploadMulti} disabled={subiendo} />
          </label>
        </div>
      </div>

      {/* GRILLA DE DOCUMENTOS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {documentos.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest italic text-center">Sin registros digitalizados</p>
          </div>
        ) : (
          documentos.map((doc) => (
            <motion.div 
              key={doc.id} 
              whileHover={{ y: -5 }} 
              onClick={() => {
                if (modoSeleccion) {
                  setSeleccionMultiples(prev => prev.includes(doc.id) ? prev.filter(x => x !== doc.id) : [...prev, doc.id]);
                } else {
                  abrirVisor(doc);
                }
              }} 
              className={`group cursor-pointer bg-white p-5 rounded-[2.5rem] border shadow-sm transition-all text-left relative ${modoSeleccion && seleccionMultiples.includes(doc.id) ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-400'}`}
            >
              
              {/* CHECKBOX SELECCIÓN */}
              <AnimatePresence>
                {modoSeleccion && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute top-4 left-4 z-10">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${seleccionMultiples.includes(doc.id) ? 'bg-blue-600 shadow-md border-transparent' : 'bg-white/90 backdrop-blur border-2 border-slate-300 shadow-sm'}`}>
                       {seleccionMultiples.includes(doc.id) && <Check size={16} className="text-white" strokeWidth={3} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={`aspect-square bg-slate-50 rounded-[2rem] mb-4 overflow-hidden flex items-center justify-center relative transition-opacity ${modoSeleccion && seleccionMultiples.includes(doc.id) ? 'opacity-70' : ''}`}>
                {(doc.tipo_archivo || '').includes('image') ? (
                  <img src={doc.url_archivo} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <FileText className="text-slate-200" size={40} />
                )}
                {!modoSeleccion && (
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors flex items-center justify-center">
                     <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                  </div>
                )}
              </div>
              <div className="px-1 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase truncate leading-tight">{doc.titulo || doc.nombre_archivo}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tight">
                  {doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString('es-CL') : 'S/F'}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 🔥 BARRA FLOTANTE DE ACCIONES MÚLTIPLES ACTUALIZADA 🔥 */}
      <AnimatePresence>
        {modoSeleccion && seleccionMultiples.length > 0 && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-3 rounded-[2rem] shadow-2xl z-[99999] flex items-center gap-4">
                <div className="px-5 text-white border-r border-white/10 pr-6 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Seleccionados</p>
                    <p className="font-bold">{seleccionMultiples.length} archivos</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* 🔥 NUEVO BOTÓN: DESCARGAR MÚLTIPLES ARCHIVOS FÍSICOS 🔥 */}
                    <button onClick={descargarMultiples} className="px-6 py-3.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-md">
                        <Download size={16}/> Descargar
                    </button>
                    <button onClick={() => {
                        setDatosRenombrar(documentos.filter(d => seleccionMultiples.includes(d.id)).map(d => ({id: d.id, titulo: d.titulo || d.nombre_archivo, url: d.url_archivo, tipo: d.tipo_archivo})))
                        setModalRenombrarAbierto(true)
                    }} className="px-6 py-3.5 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                        <Edit3 size={16}/> Renombrar
                    </button>
                    <button onClick={eliminarMultiples} className="px-6 py-3.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                        <Trash2 size={16}/> Eliminar
                    </button>
                </div>
                <button onClick={() => { setSeleccionMultiples([]); setModoSeleccion(false); }} className="p-3 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors ml-1">
                    <X size={20}/>
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL PARA RENOMBRAR EN BLOQUE */}
      <AnimatePresence>
        {modalRenombrarAbierto && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
              <div className="p-8 border-b border-slate-100 bg-blue-50 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm"><Edit3 size={20}/></div>
                    <div>
                      <h2 className="font-black text-xl uppercase tracking-tighter text-blue-900 leading-none">Renombrar Archivos</h2>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">Editando {datosRenombrar.length} elementos</p>
                    </div>
                 </div>
                 <button onClick={() => setModalRenombrarAbierto(false)} className="p-2 text-blue-400 hover:bg-blue-200 rounded-full transition-colors"><X size={18}/></button>
              </div>
              
              <div className="flex-1 p-8 overflow-y-auto space-y-4 bg-slate-50 custom-scrollbar">
                 {datosRenombrar.map((doc, idx) => (
                    <div key={doc.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                       <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                          {(doc.tipo || '').includes('image') ? <img src={doc.url} className="w-full h-full object-cover" /> : <FileText size={24} className="text-slate-400"/>}
                       </div>
                       <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nuevo Título</label>
                          <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 ring-blue-500/20 transition-all" value={doc.titulo} onChange={(e) => {
                             const updated = [...datosRenombrar];
                             updated[idx].titulo = e.target.value;
                             setDatosRenombrar(updated);
                          }} />
                       </div>
                    </div>
                 ))}
              </div>

              <div className="p-8 bg-white border-t border-slate-100 shrink-0">
                 <button onClick={guardarNombresMultiples} className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                   <Save size={18} /> Guardar Todos los Títulos
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VISOR MODAL (PORTAL INDIVIDUAL) */}
      {isMounted && createPortal(
        <AnimatePresence>
          {visorAbierto && seleccionado && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[99999] flex flex-col lg:flex-row overflow-hidden text-left"
            >
              <div className="lg:w-[80%] w-full h-full relative flex items-center justify-center p-4 lg:p-12 overflow-hidden text-left">
                  
                  {/* BARRA DE ZOOM */}
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

                  {/* BOTÓN DESCARGA INDIVIDUAL */}
                  <div className="absolute top-8 right-8 flex gap-3 z-30">
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = seleccionado.url_archivo;
                        link.download = seleccionado.nombre_archivo || 'documento_clinico'; 
                        link.target = "_blank";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("Descarga iniciada");
                      }}
                      className="bg-slate-900 text-white p-3 rounded-2xl hover:bg-blue-600 transition-all shadow-lg"
                      title="Descargar archivo original"
                    >
                      <Download size={18} />
                    </button>
                  </div>

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

              <div className="lg:w-[20%] w-full bg-white h-full p-10 flex flex-col shadow-2xl z-30 text-left">
                <div className="flex-1 space-y-8 overflow-y-auto pr-2 text-left custom-scrollbar">
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
                      <textarea className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold outline-none border-none text-slate-900 focus:ring-2 ring-blue-500/20 min-h-[180px] resize-none" value={editando.descripcion} onChange={(e) => setEditando({...editando, descripcion: e.target.value})}></textarea>
                    </div>
                  </div>
                </div>
                <div className="pt-8 space-y-3 text-left">
                  <button onClick={guardarCambios} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3"><Save size={18}/> Guardar Cambios</button>
                  <button onClick={eliminarArchivo} className="w-full bg-red-50 text-red-500 py-4 rounded-3xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"><Trash2 size={16}/> Eliminar Archivo</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}}></style>
    </div>
  )
}
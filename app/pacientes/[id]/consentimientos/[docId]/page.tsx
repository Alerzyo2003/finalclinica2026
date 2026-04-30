'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Printer, ShieldCheck, Loader2, X
} from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { toast } from 'sonner'

export default function DetalleConsentimientoPage() {
  const params = useParams()
  const docId = params.docId
  const pacienteId = params.id
  const sigCanvas = useRef<any>(null)

  const [documento, setDocumento] = useState<any>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [especialista, setEspecialista] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (docId) fetchTodo()
  }, [docId])

  async function fetchTodo() {
    setCargando(true)
    try {
      const { data: doc } = await supabase.from('paciente_consentimientos').select('*').eq('id', docId).maybeSingle()
      const { data: pac } = await supabase.from('pacientes').select('*').eq('id', pacienteId).maybeSingle()

      if (doc?.especialista_id) {
        const [profRes, perfRes] = await Promise.all([
          supabase.from('profesionales').select('nombre, apellido, especialidades(nombre)').eq('user_id', doc.especialista_id).maybeSingle(),
          supabase.from('perfiles').select('rut').eq('id', doc.especialista_id).maybeSingle()
        ])
        if (profRes.data) {
          setEspecialista({
            nombre_completo: `Dr/a. ${profRes.data.nombre} ${profRes.data.apellido}`,
            especialidad: (profRes.data as any).especialidades?.nombre || 'Especialista',
            rut: perfRes.data?.rut || '---'
          })
        }
      }
      setDocumento(doc)
      setPaciente(pac)
    } catch (e) { console.error(e) } finally { setCargando(false) }
  }

  const handlePrint = () => {
    if (!documento || !paciente) return;

    const ventanaPoderosa = window.open('', '_blank', 'width=1000,height=900');
    if (!ventanaPoderosa) return toast.error("Por favor permite los pop-ups");

    // Construcción del HTML de impresión con estilos fijos
    ventanaPoderosa.document.write(`
      <html>
        <head>
          <title>Consentimiento - ${documento.nombre_consentimiento}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            @page { margin: 0; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: white; color: black; }
            
            /* Contenedor de márgenes por página */
            .page-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .margin-spacer { height: 2.5cm; } /* Margen arriba y abajo de cada hoja */
            
            .content-wrapper { padding: 0 2.5cm; box-sizing: border-box; width: 100%; }

            /* Cabecera */
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { width: 120px; height: auto; display: block; }
            .header-text h1 { font-size: 14pt; margin: 0; text-transform: uppercase; font-weight: 900; }
            .header-info { text-align: right; }
            .header-info h2 { font-size: 8pt; color: #444; margin: 0; text-transform: uppercase; }
            .header-info p { font-size: 10pt; font-weight: bold; margin: 0; }

            /* Info Paciente */
            .info-box { display: flex; justify-content: space-between; background: #f9f9f9; padding: 15px; border: 1px solid #eee; margin-bottom: 20px; }
            .info-item { width: 48%; font-size: 10pt; }
            .info-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; color: #666; display: block; }

            /* Texto Legal */
            .prose { font-size: 11pt; line-height: 1.5; text-align: justify; word-wrap: break-word; overflow-wrap: break-word; }
            .prose p { margin-bottom: 15px; }

            /* Firmas */
            .signature-section { margin-top: 40px; width: 100%; page-break-inside: avoid; }
            .signature-table { width: 100%; }
            .signature-cell { width: 45%; text-align: center; vertical-align: bottom; }
            .signature-line { border-top: 1px solid black; margin-top: 5px; padding-top: 5px; }
            .signature-img { max-height: 80px; width: auto; margin-bottom: 5px; mix-blend-mode: multiply; }
            .signature-name { font-size: 9pt; font-weight: bold; text-transform: uppercase; }
            .signature-role { font-size: 8pt; color: #666; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <table class="page-table">
            <thead><tr><td><div class="margin-spacer"></div></td></tr></thead>
            <tbody>
              <tr>
                <td>
                  <div class="content-wrapper">
                    <div class="header">
                      <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg" class="logo" />
                        <div class="header-text"><h1>Centro Médico y Dental Dignidad</h1></div>
                      </div>
                      <div class="header-info">
                        <h2>Consentimiento Informado</h2>
                        <p>${documento.nombre_consentimiento}</p>
                      </div>
                    </div>

                    <div class="info-box">
                      <div class="info-item">
                        <span class="info-label">Paciente</span>
                        <strong>${paciente.nombre} ${paciente.apellido}</strong><br/>
                        RUT: ${paciente.rut}
                      </div>
                      <div class="info-item" style="text-align: right;">
                        <span class="info-label">Especialista</span>
                        <strong>${especialista?.nombre_completo || documento.creado_por}</strong><br/>
                        ${especialista?.especialidad || ''} • RUT: ${especialista?.rut || ''}
                      </div>
                    </div>

                    <div class="prose">
                      ${documento.contenido_legal}
                    </div>

                    <div class="signature-section">
                      <table class="signature-table">
                        <tr>
                          <td class="signature-cell">
                            ${documento.img_firma_especialista ? `<img src="${documento.img_firma_especialista}" class="signature-img" />` : '<div style="height: 80px;"></div>'}
                            <div class="signature-line">
                              <div class="signature-name">${especialista?.nombre_completo || documento.creado_por}</div>
                              <div class="signature-role">Firma Especialista</div>
                            </div>
                          </td>
                          <td style="width: 10%;"></td>
                          <td class="signature-cell">
                            ${documento.img_firma_paciente ? `<img src="${documento.img_firma_paciente}" class="signature-img" />` : '<div style="height: 80px;"></div>'}
                            <div class="signature-line">
                              <div class="signature-name">${paciente.nombre} ${paciente.apellido}</div>
                              <div class="signature-role">Aceptación Paciente</div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot><tr><td><div class="margin-spacer"></div></td></tr></tfoot>
          </table>
          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    ventanaPoderosa.document.close();
  };

  const guardarFirmaEspecialista = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return toast.error("Debe firmar")
    setGuardando(true)
    try {
      const dataFirma = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
      await supabase.from('paciente_consentimientos').update({
        firma_profesional: 'Firmado',
        img_firma_especialista: dataFirma,
        fecha_firma_especialista: new Date().toISOString()
      }).eq('id', docId)
      toast.success("Documento Firmado");
      fetchTodo();
    } catch (e) { toast.error("Error al guardar firma") } finally { setGuardando(false) }
  }

  if (cargando) return <div className="h-screen flex flex-col items-center justify-center bg-white gap-4"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-left pb-20">
      <nav className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-full transition-all"><ChevronLeft size={24} /></button>
          <div className="text-left">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Archivo Clínico</h2>
            <p className="text-sm font-bold text-slate-800 uppercase italic leading-none">{documento?.nombre_consentimiento}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-black text-[10px] uppercase hover:bg-slate-50 flex items-center gap-2 shadow-sm">
            <Printer size={14} /> Imprimir
          </button>
          {documento?.firma_profesional !== 'Firmado' && (
            <button onClick={guardarFirmaEspecialista} disabled={guardando} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-2xl hover:bg-blue-600 transition-all flex items-center gap-2">
               {guardando ? <Loader2 className="animate-spin" size={14}/> : <ShieldCheck size={14} />} Firmar
            </button>
          )}
        </div>
      </nav>

      <main className="w-full flex flex-col items-center p-12 max-md:p-4">
        {/* VISTA PREVIA WEB */}
        <div className="w-full max-w-[850px] bg-white shadow-2xl flex flex-col mx-auto text-left rounded-3xl overflow-hidden border border-slate-200">
          <div className="p-16 max-md:p-8 flex flex-col">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
              <div className="flex items-start gap-4">
                <img src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg" alt="Logo" className="h-20 w-auto" />
                <div className="mt-4 text-left"><h1 className="text-lg font-black uppercase text-slate-900 leading-tight">Centro Médico y Dental Dignidad</h1></div>
              </div>
              <div className="text-right mt-4">
                <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-tighter mb-1">Consentimiento Informado</h2>
                <p className="text-sm font-black text-slate-900 uppercase italic leading-none">{documento?.nombre_consentimiento}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-12 bg-slate-50 p-8 rounded-2xl border border-slate-100 text-left">
              <div className="space-y-1 text-left">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Paciente</span>
                <p className="text-sm font-black text-slate-800 uppercase leading-none">{paciente?.nombre} {paciente?.apellido}</p>
                <p className="text-xs text-slate-500 font-bold">RUT: {paciente?.rut}</p>
              </div>
              <div className="text-right space-y-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Especialista</span>
                <p className="text-sm font-black text-slate-800 uppercase leading-none">{especialista?.nombre_completo || documento?.creado_por}</p>
                <p className="text-xs text-slate-500 font-bold">{especialista?.especialidad} • RUT: {especialista?.rut}</p>
              </div>
            </div>

            <div className="prose max-w-full text-slate-700 text-[16px] leading-relaxed text-justify mb-20 text-left" dangerouslySetInnerHTML={{ __html: documento?.contenido_legal }} />

            <div className="mt-auto grid grid-cols-2 gap-20 pt-10 border-t-2 border-slate-100">
              <div className="text-center flex flex-col items-center">
                <div className="w-full h-32 border-b border-slate-200 mb-4 flex items-center justify-center">
                  {documento?.img_firma_especialista && <img src={documento.img_firma_especialista} className="max-h-full object-contain" />}
                </div>
                <p className="text-[10px] font-bold text-slate-800 uppercase mt-2">{especialista?.nombre_completo || documento?.creado_por}</p>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="w-full h-32 border-b border-slate-200 mb-4 flex items-center justify-center">
                  {documento?.img_firma_paciente && <img src={documento.img_firma_paciente} className="max-h-full object-contain" />}
                </div>
                <p className="text-[10px] font-bold text-slate-800 uppercase mt-2 italic">{paciente?.nombre} {paciente?.apellido}</p>
              </div>
            </div>
          </div>
        </div>

        {/* PAD DE FIRMA */}
        {documento?.firma_profesional !== 'Firmado' && (
          <aside className="w-full max-w-[400px] mt-10 mx-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-slate-900 text-left">
              <h3 className="text-sm font-black uppercase italic text-slate-800 mb-6 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-600" /> Registrar Firma Médica</h3>
              <div className="bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-200 overflow-hidden mb-6 h-64">
                <SignatureCanvas ref={sigCanvas} penColor='#000' canvasProps={{className: 'w-full h-full'}} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => sigCanvas.current?.clear()} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-red-50 transition-all">Limpiar</button>
                <button onClick={guardarFirmaEspecialista} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all">Firmar Documento</button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}
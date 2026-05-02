'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Printer, ShieldCheck, Loader2, Download } from 'lucide-react'
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
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => { if (docId) fetchTodo() }, [docId])

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
            nombre: `Dr/a. ${profRes.data.nombre} ${profRes.data.apellido}`,
            especialidad: (profRes.data as any).especialidades?.nombre || 'Especialista',
            rut: perfRes.data?.rut || '---'
          })
        }
      } else if (doc?.creado_por) {
        setEspecialista({ nombre: doc.creado_por, especialidad: 'Especialista', rut: '---' })
      }

      setDocumento(doc)
      setPaciente(pac)
    } catch (e) { console.error(e) } finally { setCargando(false) }
  }

  const handlePrint = async () => {
    setGenerandoPdf(true);
    const toastId = toast.loading("Preparando documento numerado para imprimir...");

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('documento-pdf');

      const opt = {
        margin:       15,
        filename:     `Consentimiento_${paciente?.rut || 'Clinica'}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' }, 
        jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120); 
          pdf.text(`Página ${i} de ${totalPages}`, pdf.internal.pageSize.getWidth() - 35, pdf.internal.pageSize.getHeight() - 8);
        }
        
        window.open(pdf.output('bloburl'), '_blank');
      });

      toast.success("Documento listo para imprimir", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al preparar la impresión", { id: toastId });
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleDownloadPDF = async () => {
    setGenerandoPdf(true);
    const toastId = toast.loading("Procesando y numerando PDF...");

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('documento-pdf');

      const opt = {
        margin:       15,
        filename:     `Consentimiento_${paciente?.rut || 'Clinica'}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' }, 
        jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120); 
          pdf.text(`Página ${i} de ${totalPages}`, pdf.internal.pageSize.getWidth() - 35, pdf.internal.pageSize.getHeight() - 8);
        }
      }).save();

      toast.success("PDF descargado con éxito", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el PDF", { id: toastId });
    } finally {
      setGenerandoPdf(false);
    }
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

  if (cargando) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-left pb-20">
      
      {/* NAVBAR WEB */}
      <nav className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-full transition-all"><ChevronLeft size={24} /></button>
          <div className="text-left">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Clínica Dignidad</h2>
            <p className="text-sm font-bold text-slate-800 uppercase italic leading-none">{documento?.nombre_consentimiento}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} disabled={generandoPdf} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase shadow-sm hover:bg-slate-50 flex items-center gap-2 transition-all">
            {generandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} 
            {generandoPdf ? 'Preparando...' : 'Imprimir'}
          </button>
          <button onClick={handleDownloadPDF} disabled={generandoPdf} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-all">
            {generandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
            {generandoPdf ? 'Generando...' : 'Descargar PDF'}
          </button>
          {documento?.firma_profesional !== 'Firmado' && (
            <button onClick={guardarFirmaEspecialista} disabled={guardando} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
              {guardando ? <Loader2 className="animate-spin" size={14}/> : <ShieldCheck size={14} />} Firmar
            </button>
          )}
        </div>
      </nav>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="w-full flex flex-col items-center p-12 max-md:p-4">
        
        <div className="w-full max-w-[850px] shadow-2xl mx-auto bg-white rounded-3xl overflow-hidden border border-slate-200">
          
          <div id="documento-pdf" style={{ backgroundColor: '#ffffff', color: '#000000', padding: '50px', fontFamily: 'Arial, sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #000000', paddingBottom: '20px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg" alt="Logo" style={{ height: '90px', width: 'auto' }} crossOrigin="anonymous" />
                <div style={{ textAlign: 'left' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', margin: 0, lineHeight: '1.2' }}>Centro Médico y Dental<br/>Dignidad</h1>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', letterSpacing: '1px', margin: '0 0 4px 0' }}>Consentimiento Informado</h2>
                <p style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontStyle: 'italic', margin: 0 }}>{documento?.nombre_consentimiento}</p>
              </div>
            </div>

            {/* DATOS DEL PACIENTE, TRATAMIENTO Y ESPECIALISTA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000000', borderBottom: '1px solid #000000', padding: '15px 0', marginBottom: '40px', pageBreakInside: 'avoid' }}>
              
              <div style={{ width: '33%', textAlign: 'left' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#555555', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Paciente</span>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{paciente?.nombre} {paciente?.apellido}</p>
                <p style={{ fontSize: '12px', color: '#000000', margin: 0 }}>RUT: {paciente?.rut}</p>
              </div>
              
              {/* COLUMNA CENTRAL: TRATAMIENTO LIGADO AL PRESUPUESTO_ID */}
              <div style={{ width: '33%', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#555555', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Tratamiento</span>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{documento?.nombre_consentimiento}</p>
                <p style={{ fontSize: '12px', color: '#000000', margin: 0 }}>
                  ID: {documento?.presupuesto_id ? String(documento.presupuesto_id).split('-')[0].toUpperCase() : 'NO ASOCIADO'}
                </p>
              </div>

              <div style={{ width: '33%', textAlign: 'right' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#555555', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Especialista Tratante</span>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{especialista?.nombre}</p>
                <p style={{ fontSize: '12px', color: '#000000', margin: 0 }}>{especialista?.especialidad} {especialista?.rut !== '---' && `• RUT: ${especialista?.rut}`}</p>
              </div>

            </div>

            <div 
              style={{ fontSize: '14px', lineHeight: '1.6', color: '#000000', textAlign: 'justify', marginBottom: '60px', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }} 
              dangerouslySetInnerHTML={{ __html: documento?.contenido_legal }} 
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '40px', pageBreakInside: 'avoid' }}>
              <div style={{ width: '45%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid #000000', paddingBottom: '10px', marginBottom: '10px' }}>
                  {documento?.img_firma_especialista && <img src={documento.img_firma_especialista} style={{ maxHeight: '70px', objectFit: 'contain' }} crossOrigin="anonymous" />}
                </div>
                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{especialista?.nombre}</p>
                <p style={{ fontSize: '10px', color: '#555555', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Firma Especialista</p>
              </div>
              
              <div style={{ width: '45%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid #000000', paddingBottom: '10px', marginBottom: '10px' }}>
                  {documento?.img_firma_paciente && <img src={documento.img_firma_paciente} style={{ maxHeight: '70px', objectFit: 'contain' }} crossOrigin="anonymous" />}
                </div>
                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{paciente?.nombre} {paciente?.apellido}</p>
                <p style={{ fontSize: '10px', color: '#555555', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Aceptación Paciente</p>
              </div>
            </div>

          </div>
        </div>

        {/* PAD DE FIRMAS WEB */}
        {documento?.firma_profesional !== 'Firmado' && (
          <aside className="w-full max-w-[400px] mt-10 mx-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-slate-900 text-left">
              <h3 className="text-sm font-black uppercase italic text-slate-800 mb-6 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-600" /> Registrar Firma Médica</h3>
              <div className="bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-200 overflow-hidden mb-6 h-64">
                <SignatureCanvas ref={sigCanvas} penColor='#000' canvasProps={{className: 'w-full h-full'}} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => sigCanvas.current?.clear()} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-red-50">Limpiar</button>
                <button onClick={guardarFirmaEspecialista} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700">Guardar Firma</button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}
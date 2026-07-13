'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Banknote, CreditCard, Landmark, 
  User, Calendar, Receipt, ArrowLeft, Printer, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

export default function DetalleCajaPage() {
  const { id: cajaId } = useParams()
  const router = useRouter()
  const [caja, setCaja] = useState<any>(null)
  const [pagos, setPagos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => {
    if (cajaId) fetchDetalleCaja()
  }, [cajaId])

  async function fetchDetalleCaja() {
    setCargando(true)
    try {
      // 1. Info de la sesión
      const { data: sesion } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('id', cajaId)
        .maybeSingle() 

      // 2. Pagos con casting de tipo para evitar errores de compilación
      const { data: listaPagos } = await supabase
        .from('pagos')
        .select(`
          id,
          monto,
          metodo_pago,
          convenio,
          fecha_vencimiento,
          numero_referencia,
          numero_boleta,
          fecha_pago,
          pacientes(nombre, apellido)
        `)
        .eq('caja_id', cajaId)
        .order('fecha_pago', { ascending: true })

      setCaja(sesion)
      setPagos(listaPagos || [])
    } catch (error) {
      console.error("Error cargando detalle:", error)
    } finally {
      setCargando(false)
    }
  }

  const resumenPagos = useMemo(() => {
  if (!pagos || pagos.length === 0) return null;

  // Definimos la interfaz interna para que TypeScript sepa qué tiene 'stats'
  const resumen = pagos.reduce((acc: Record<string, { count: number; total: number }>, pago) => {
    const metodo = pago.metodo_pago?.toLowerCase() || 'desconocido';
    const monto = Number(pago.monto || 0);
    
    if (!acc[metodo]) {
      acc[metodo] = { count: 0, total: 0 };
    }
    acc[metodo].count++;
    acc[metodo].total += monto;
    return acc;
  }, {});

  return resumen;
}, [pagos]);

  const totalRecaudado = useMemo(() => {
    if (!pagos) return 0;
    return pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  }, [pagos]);

  const handlePrint = async () => {
    setGenerandoPdf(true);
    const toastId = toast.loading("Preparando reporte para imprimir...");

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('reporte-impresion-contenido');

      if (!element) {
        toast.error("No se pudo encontrar el contenido para imprimir.", { id: toastId });
        return;
      }

      const opt: any = { // Usar 'any' ignora la validación estricta de tipos que está fallando
  margin: [15, 15, 20, 15] as [number, number, number, number], 
  filename: `Cierre_Caja_${caja?.nombre_responsable.replace(' ', '_') || 'reporte'}.pdf`,
  image: { type: 'jpeg', quality: 1 },
  html2canvas: { 
    scale: 2, 
    useCORS: true, 
    letterRendering: true, 
    backgroundColor: '#ffffff', 
    scrollY: 0 
  }, 
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css', 'legacy'] }
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

      toast.success("Reporte listo para imprimir", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al preparar la impresión", { id: toastId });
    } finally {
      setGenerandoPdf(false);
    }
  };

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-xs uppercase tracking-widest text-slate-400">Generando reporte de caja...</p>
    </div>
  )

  if (!caja) return <div className="p-20 text-center font-black">CAJA NO ENCONTRADA</div>

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-slate-900 text-left">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER - No imprimible */}
        <div className="flex justify-between items-center print:hidden">
          <button 
            onClick={() => router.push('/cajas')}
            className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase hover:text-blue-600 transition-all bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
          >
            <ArrowLeft size={14} /> Volver a gestión
          </button>
          <button 
            onClick={handlePrint}
            disabled={generandoPdf}
            className="flex items-center gap-2 font-black text-[10px] text-white uppercase bg-slate-900 px-6 py-2 rounded-xl shadow-lg hover:bg-blue-600 transition-all disabled:bg-slate-400"
          >
            {generandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} 
            {generandoPdf ? 'Generando...' : 'Imprimir Cierre'}
          </button>
        </div>

        {/* RESUMEN SUPERIOR */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8 text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-blue-200 shadow-lg">
              <Receipt size={32} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Resumen de Caja</p>
              <h1 className="text-3xl font-black uppercase italic text-slate-800 tracking-tighter text-left">
                {caja.nombre_responsable}
              </h1>
              <p className="text-xs font-bold text-slate-500 text-left">Cierre: {caja.fecha_cierre ? new Date(caja.fecha_cierre).toLocaleString('es-CL') : 'Turno Abierto'}</p>
            </div>
          </div>
          <div className="flex gap-10 text-right">
             <div className="text-right">
               <p className="text-[9px] font-black text-slate-400 uppercase text-right">Fondo Inicial</p>
               <p className="text-xl font-black text-slate-700 text-right">${Number(caja.monto_apertura || 0).toLocaleString('es-CL')}</p>
             </div>
             <div className="text-right">
               <p className="text-[9px] font-black text-slate-400 uppercase text-blue-600 text-right">Total Recaudado</p>
               <p className="text-3xl font-black text-blue-600 text-right">${Number(caja.monto_cierre || 0).toLocaleString('es-CL')}</p>
             </div>
          </div>
        </div>

        {/* DESGLOSE DE MÉTODOS DE PAGO */}
        {resumenPagos && Object.keys(resumenPagos).length > 0 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 text-left">
              Desglose por Medio de Pago
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(resumenPagos).map(([metodo, stats]) => (
                <div key={metodo} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-1 text-left">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {metodo} (Cant: {stats.count})
                  </span>
                  <span className="text-xl font-black text-slate-800 tracking-tight">
                    ${stats.total.toLocaleString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABLA DETALLADA */}
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden text-left">
          <div className="overflow-x-auto text-left">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase font-black text-[9px] tracking-[0.1em]">
                  <th className="px-6 py-5 text-left">#</th>
                  <th className="px-6 py-5 text-left">Nombre Paciente</th>
                  <th className="px-6 py-5 text-left">Medio de Pago</th>
                  <th className="px-6 py-5 text-left">Convenio</th>
                  <th className="px-6 py-5 text-left">Vencimiento</th>
                  <th className="px-6 py-5 text-left"># Referencia</th>
                  <th className="px-6 py-5 text-left"># Boleta</th>
                  <th className="px-6 py-5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map((p, index) => {
                  const pac = p.pacientes as any;
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group text-left">
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-400 italic text-left">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <p className="text-xs font-black uppercase text-slate-700 text-left">
                          {pac ? `${pac.nombre} ${pac.apellido}` : 'Sin nombre'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-2 text-left">
                          {p.metodo_pago === 'efectivo' ? <Banknote size={14} className="text-emerald-500"/> : <CreditCard size={14} className="text-blue-500"/>}
                          <span className="text-[10px] font-black uppercase text-slate-500">{p.metodo_pago}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-left">
                        {p.convenio || '—'}
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500 text-left">
                        {p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString('es-CL') : '—'}
                      </td>
                      <td className="px-6 py-4 text-[10px] font-mono font-bold text-blue-600 text-left">
                        {p.numero_referencia || '—'}
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-700 text-left">
                        {p.numero_boleta || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-900 text-right">
                          ${Number(p.monto || 0).toLocaleString('es-CL')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {pagos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <p className="text-slate-300 font-black uppercase text-xs italic tracking-widest">No se registraron pagos en esta sesión</p>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-right text-[10px] font-black uppercase text-slate-400">Total Turno:</td>
                  <td className="px-6 py-6 text-right text-xl font-black text-slate-900">
                    ${Number((caja.monto_cierre || 0) - (caja.monto_apertura || 0)).toLocaleString('es-CL')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* CONTENIDO PARA IMPRESIÓN (OCULTO EN PANTALLA) */}
        <div className="absolute -left-[9999px] top-auto" style={{ width: '850px' }}>
          <div id="reporte-impresion-contenido" style={{ boxSizing: 'border-box', backgroundColor: 'white', padding: '48px', fontFamily: 'sans-serif', color: '#0f172a' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', marginBottom: '24px', borderBottom: '2px solid #1e293b' }}>
              <div style={{ width: '66.6667%' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>CENTRO MÉDICO Y DENTAL DIGNIDAD</h1>
                <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500' }}>Venancia Leiva 1871, La Pintana, Región Metropolitana</p>
              </div>
              <div style={{ width: '33.3333%', textAlign: 'right' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>Cierre de Caja</h2>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569', marginTop: '4px' }}>
                  ID Sesión: <span style={{ color: '#0f172a', fontWeight: '700' }}>#{caja.id.substring(0, 8)}</span>
                </p>
              </div>
            </header>

            <section style={{ marginBottom: '32px', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '32px', rowGap: '8px' }}>
                <div><p style={{ fontWeight: '700', color: '#64748b' }}>Responsable:</p><p style={{ fontWeight: '700', fontSize: '1.125rem', color: '#0f172a' }}>{caja.nombre_responsable}</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontWeight: '700', color: '#64748b' }}>Estado:</p><p style={{ fontWeight: '700', fontSize: '1.125rem', textTransform: 'uppercase', color: '#0f172a' }}>{caja.estado}</p></div>
                <div><p style={{ fontWeight: '700', color: '#64748b' }}>Apertura:</p><p style={{ color: '#0f172a' }}>{new Date(caja.fecha_apertura).toLocaleString('es-CL')}</p></div>
                <div style={{ textAlign: 'right' }}><p style={{ fontWeight: '700', color: '#64748b' }}>Cierre:</p><p style={{ color: '#0f172a' }}>{caja.fecha_cierre ? new Date(caja.fecha_cierre).toLocaleString('es-CL') : 'TURNO ACTIVO'}</p></div>
              </div>
            </section>

            <section style={{ marginBottom: '32px', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', textAlign: 'center' }}>
                <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '0.5rem' }}><p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Fondo Inicial</p><p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>${Number(caja.monto_apertura || 0).toLocaleString('es-CL')}</p></div>
                <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '0.5rem' }}><p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Recaudado</p><p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>${Number((caja.monto_cierre || 0) - (caja.monto_apertura || 0)).toLocaleString('es-CL')}</p></div>
                <div style={{ backgroundColor: '#dbeafe', padding: '16px', borderRadius: '0.5rem' }}><p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#2563eb' }}>Total en Caja</p><p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1d4ed8' }}>${Number(caja.monto_cierre || 0).toLocaleString('es-CL')}</p></div>
              </div>
            </section>

            {/* IMPRESIÓN: DESGLOSE MÉTODOS DE PAGO */}
            {resumenPagos && Object.keys(resumenPagos).length > 0 && (
              <section style={{ marginBottom: '32px', fontSize: '0.875rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', color: '#0f172a', borderTop: '2px solid #e2e8f0', paddingTop: '16px' }}>Desglose por Medio de Pago</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
                  {Object.entries(resumenPagos).map(([metodo, stats]) => (
                    <div key={metodo} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>{metodo} (Cant: {stats.count})</p>
                      <p style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a' }}>${stats.total.toLocaleString('es-CL')}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', borderTop: '2px solid #1e293b', paddingTop: '24px', color: '#0f172a' }}>Detalle de Pagos</h3>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #94a3b8' }}>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>N°</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>Paciente</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>Medio Pago</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>Convenio</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>N° Transf.</th>
                    <th style={{ textAlign: 'left', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>N° Boleta</th>
                    <th style={{ textAlign: 'right', padding: '8px 2px', fontWeight: '700', textTransform: 'uppercase' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, index) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{index + 1}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase', wordBreak: 'break-word' }}>{p.pacientes ? `${p.pacientes.nombre} ${p.pacientes.apellido}` : 'S/N'}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{p.metodo_pago}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{p.convenio || '-'}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{new Date(p.fecha_pago).toLocaleDateString('es-CL')}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{p.numero_referencia || '-'}</td>
                      <td style={{ padding: '8px 2px', textTransform: 'uppercase' }}>{p.numero_boleta || '-'}</td>
                      <td style={{ padding: '8px 2px', textAlign: 'right', fontWeight: '700' }}>${Number(p.monto || 0).toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #1e293b' }}>
                    <td colSpan={7} style={{ textAlign: 'right', padding: '12px 0', fontWeight: '700', textTransform: 'uppercase' }}>Total Recaudado</td>
                    <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: '900', fontSize: '1rem' }}>${Number((caja.monto_cierre || 0) - (caja.monto_apertura || 0)).toLocaleString('es-CL')}</td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <footer style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
              <p>Documento generado automáticamente por el sistema.</p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  )
}

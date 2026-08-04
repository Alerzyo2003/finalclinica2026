'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  DollarSign, Search, User, ArrowRight, Loader2, 
  CheckCircle2, CreditCard, Hash, Wallet
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function PagosPendientesPage() {
  const [pacientesDeudores, setPacientesDeudores] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetchDeudores()

    // Suscripción Realtime para actualizar si el saldo cambia
    const canal = supabase
      .channel('cambios-saldos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pacientes' }, () => {
        fetchDeudores()
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [])

  async function fetchDeudores() {
    try {
      // Helper para obtener todos los registros, superando el límite de 1000 filas de Supabase
      const fetchAll = async (queryBuilder: any) => {
        const BATCH_SIZE = 1000;
        let allRecords: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await queryBuilder.range(from, from + BATCH_SIZE - 1);
          if (error) throw error;
          if (data) allRecords = allRecords.concat(data);
          if (!data || data.length < BATCH_SIZE) break;
          from += BATCH_SIZE;
        }
        return allRecords;
      };

      // 1. Obtener todos los datos necesarios de forma paginada
      const [
        todosLosPacientes,
        todosLosPresupuestos,
        todosTempPresupuestos,
        todosPresupuestoItems,
        todosTempItems
      ] = await Promise.all([
        fetchAll(supabase.from('pacientes').select('id, rut')),
        fetchAll(supabase.from('presupuestos').select('id, paciente_id, aprobado, id_dentalink')),
        fetchAll(supabase.from('temp_presupuestos').select('rut, id_dentalink')),
        fetchAll(supabase.from('presupuesto_items').select('presupuesto_id, precio_pactado, abonado, estado').neq('estado', 'cancelada')),
        fetchAll(supabase.from('temp_items').select('rut, id_dentalink, precio_pactado, abonado, estado').not('estado', 'is', null))
      ]);

      // 2. Crear mapas para búsquedas eficientes
      const rutToPacienteIdMap = new Map(todosLosPacientes.map((p: any) => [p.rut.trim().toUpperCase(), p.id]));
      const presupuestoToPacienteIdMap = new Map(todosLosPresupuestos.map((p: any) => [p.id, p.paciente_id]));

      // 3. Inicializar el objeto de deudas
      const deudasPorPaciente: Record<string, { totalPactado: number, totalRealizado: number, totalAbonado: number }> = {};
      todosLosPacientes.forEach((p: any) => {
        deudasPorPaciente[p.id] = { totalPactado: 0, totalRealizado: 0, totalAbonado: 0 };
      });

      // 4. Procesar ítems OFICIALES de planes APROBADOS
      const idsPresupuestosAprobados = new Set(todosLosPresupuestos.filter((p: any) => p.aprobado).map((p: any) => p.id));
      
      todosPresupuestoItems
        .filter((item: any) => idsPresupuestosAprobados.has(item.presupuesto_id))
        .forEach((item: any) => {
          const pacId = presupuestoToPacienteIdMap.get(item.presupuesto_id);
          if (!pacId || !deudasPorPaciente[pacId]) return;

          deudasPorPaciente[pacId].totalPactado += Number(item.precio_pactado || 0);
          const estado = String(item.estado || 'pendiente').toLowerCase().trim();
          if (['realizado', 'atendido', 'finalizado', 'terminado'].includes(estado)) {
            deudasPorPaciente[pacId].totalRealizado += Number(item.precio_pactado || 0);
          }
          deudasPorPaciente[pacId].totalAbonado += Number(item.abonado || 0);
        });

      // 5. Procesar ítems TEMPORALES (Dentalink) de planes aprobados o temporales
      const dentalinkIdsFromApproved = new Set(todosLosPresupuestos.filter((p: any) => p.aprobado && p.id_dentalink).map((p: any) => String(p.id_dentalink)));
      const dentalinkIdsFromTemp = new Set(todosTempPresupuestos.map((p: any) => String(p.id_dentalink)));
      const todosIdsDentalinkValidos = new Set([...dentalinkIdsFromApproved, ...dentalinkIdsFromTemp]);

      todosTempItems
        .filter((item: any) => todosIdsDentalinkValidos.has(String(item.id_dentalink)))
        .forEach((item: any) => {
          if (!item.rut) return;
          const pacId = rutToPacienteIdMap.get(item.rut.trim().toUpperCase());
          if (!pacId || !deudasPorPaciente[pacId]) return;

          deudasPorPaciente[pacId].totalPactado += Number(item.precio_pactado || 0);
          const estado = String(item.estado || 'pendiente').toLowerCase().trim();
          if (['realizado', 'atendido', 'finalizado', 'terminado'].includes(estado)) {
            deudasPorPaciente[pacId].totalRealizado += Number(item.precio_pactado || 0);
          }
          deudasPorPaciente[pacId].totalAbonado += Number(item.abonado || 0);
        });

      // 6. Calcular deuda exigible y filtrar pacientes
      const pacientesConDeudaExigible = Object.entries(deudasPorPaciente)
        .map(([paciente_id, { totalPactado, totalRealizado, totalAbonado }]) => {
          const deuda_exigible = Math.max(0, totalRealizado - totalAbonado);
          const deuda_total = Math.max(0, totalPactado - totalAbonado);
          return { paciente_id, deuda_exigible, deuda_total };
        })
        .filter(p => p.deuda_exigible > 0);

      if (pacientesConDeudaExigible.length === 0) {
        setPacientesDeudores([]);
        setCargando(false);
        return;
      }

      // 7. Traer los datos de los pacientes deudores
      const { data: pacientesData, error: errPac } = await supabase
        .from('pacientes')
        .select('id, nombre, apellido, rut')
        .in('id', pacientesConDeudaExigible.map(p => p.paciente_id));
      if (errPac) throw new Error(`Error al obtener datos de pacientes: ${errPac.message}`);

      const resultadoFinal = (pacientesData || []).map(paciente => {
        const deudas = pacientesConDeudaExigible.find(p => p.paciente_id === paciente.id);
        return { ...paciente, saldo_pendiente: deudas?.deuda_total || 0 };
      }).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);

      setPacientesDeudores(resultadoFinal);
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setCargando(false)
    }
  }

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
  }

  const filtrados = pacientesDeudores.filter(p => 
    `${p.nombre} ${p.apellido} ${p.rut}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#FBF8F2]">
      <Loader2 className="animate-spin text-[#C9A24B] mb-4" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Sincronizando deudas...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#FBF8F2] p-6 md:p-10 font-sans text-slate-900 relative overflow-hidden z-0">
      
      {/* IMAGEN DE FONDO GLOBAL */}
      <div 
        className="absolute top-0 right-0 w-[700px] h-[800px] bg-[url('/fondo-profesionales.png')] bg-contain bg-right-top bg-no-repeat -z-10 pointer-events-none opacity-40 mix-blend-multiply"
      ></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10 text-left">
        
        {/* HEADER */}
        <header className="bg-white/90 backdrop-blur-md p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-left">
          <div className="flex items-center gap-5 text-left w-full md:w-auto">
            <div className="bg-[#0A111F] w-16 h-16 rounded-full flex items-center justify-center text-[#C9A24B] shadow-lg shrink-0">
              <Wallet size={28} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl md:text-3xl font-black text-[#0A111F] uppercase italic leading-none tracking-tight text-left">
                CUENTAS POR COBRAR
              </h1>
              <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1.5 text-left">
                Sincronizado con el Directorio General
              </p>
            </div>
          </div>
          
          <div className="bg-[#0A111F] px-8 py-4 rounded-3xl text-right shadow-md min-w-[240px] text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Deuda Total Cartera</p>
            <p className="text-2xl font-black text-[#C9A24B] italic tracking-tight text-left">
              {formatearMoneda(filtrados.reduce((acc, curr) => acc + Number(curr.saldo_pendiente), 0))}
            </p>
          </div>
        </header>

        {/* BUSCADOR */}
        <div className="relative group max-w-md text-left">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#C9A24B] transition-colors" size={18} />
          <input 
            type="text"
            placeholder="BUSCAR DEUDOR POR NOMBRE O RUT..."
            className="w-full bg-white/95 backdrop-blur-sm p-4 pl-12 pr-6 rounded-full border border-slate-200 shadow-sm outline-none focus:border-[#C9A24B] transition-all font-bold text-xs uppercase text-slate-900 placeholder:text-slate-400"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* GRILLA DE DEUDORES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          <AnimatePresence mode='popLayout'>
            {filtrados.map((p) => (
              <motion.div 
                key={p.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/95 backdrop-blur-sm p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-4 mb-6 text-left">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all shadow-inner shrink-0">
                      <User size={22} />
                    </div>
                    <div className="overflow-hidden text-left flex-1">
                      <p className="text-sm font-black text-[#0A111F] uppercase italic truncate leading-tight">
                        {p.nombre} {p.apellido}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1.5">
                        <Hash size={12} className="text-[#C9A24B]" /> {p.rut}
                      </p>
                    </div>
                  </div>

                  <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100/60 mb-6 text-left shadow-inner">
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Monto Pendiente:</p>
                    <p className="text-2xl font-black text-red-600 italic tracking-tight">
                      {formatearMoneda(p.saldo_pendiente)}
                    </p>
                  </div>
                </div>

                <Link 
                  href={`/pacientes/${p.id}/pagos`}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-[#0A111F] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#1a2538] transition-all active:scale-95 shadow-md"
                >
                  Gestionar Cobro <ArrowRight size={14}/>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtrados.length === 0 && !cargando && (
          <div className="py-24 text-center flex flex-col items-center gap-4 bg-white/95 backdrop-blur-sm rounded-[2.5rem] border border-slate-100 shadow-sm">
            <CheckCircle2 size={48} className="text-emerald-500 opacity-80" />
            <p className="text-slate-700 font-black text-xs uppercase tracking-widest">No hay saldos pendientes en el sistema</p>
          </div>
        )}
      </div>
    </main>
  )
}

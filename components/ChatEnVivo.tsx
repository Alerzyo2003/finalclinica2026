'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageSquareText, X, Send, Loader2, ChevronLeft, MessageSquarePlus, Paperclip, Smile } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'

// --- Función auxiliar para fechas amigables ---
const formatFechaAmigable = (fechaIso: string) => {
  const fecha = new Date(fechaIso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  const esHoy = fecha.getDate() === hoy.getDate() && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
  const esAyer = fecha.getDate() === ayer.getDate() && fecha.getMonth() === ayer.getMonth() && fecha.getFullYear() === ayer.getFullYear();
  const horaStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (esHoy) return `Hoy, ${horaStr}`;
  if (esAyer) return `Ayer, ${horaStr}`;
  return `${fecha.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${horaStr}`;
}

export default function ChatGlobal({ session }: { session: any }) {
  const miUsuario = session?.user
  
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'lista' | 'chat' | 'contactos'>('lista')
  
  const [conversaciones, setConversaciones] = useState<any[]>([])
  const [contactos, setContactos] = useState<any[]>([])
  const [chatActivo, setChatActivo] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  
  const [usuariosConectados, setUsuariosConectados] = useState<string[]>([])
  
  const [nuevoMsg, setNuevoMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const chatActivoRef = useRef(chatActivo)
  const isOpenRef = useRef(isOpen)

  useEffect(() => { chatActivoRef.current = chatActivo }, [chatActivo])
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  const reproducirSonidoSuave = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    }
  }

  useEffect(() => {
    if (!miUsuario?.id) return;

    fetchConversaciones(miUsuario.id)
    revisarMensajesNoLeidosHistoricos(miUsuario.id)
    
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: miUsuario.id } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setUsuariosConectados(Object.keys(state))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() })
        }
      })

    const msgChannel = supabase.channel('notificaciones_globales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        if (payload.new.emisor_id === miUsuario.id) return;
        const esChatActual = chatActivoRef.current?.id === payload.new.conversacion_id;
        const estaAbierto = isOpenRef.current;

        if (!estaAbierto || !esChatActual) {
          setUnread(true)
          reproducirSonidoSuave()
        } else {
           marcarComoLeido(payload.new.conversacion_id)
        }
        fetchConversaciones(miUsuario.id)
      })
      .subscribe()
      
    return () => { 
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(presenceChannel);
    }
  }, [miUsuario?.id])

  async function revisarMensajesNoLeidosHistoricos(uid: string) {
     const { data: convs } = await supabase.from('conversaciones').select('id').or(`participante1_id.eq.${uid},participante2_id.eq.${uid}`);
     if (!convs || convs.length === 0) return;
     const convIds = convs.map(c => c.id);
     const { data: sinLeer } = await supabase.from('mensajes').select('id').in('conversacion_id', convIds).neq('emisor_id', uid).eq('leido', false).limit(1);
     if (sinLeer && sinLeer.length > 0) setUnread(true);
  }

  async function marcarComoLeido(conversacionId: string) {
      if (!miUsuario?.id) return;
      await supabase.from('mensajes').update({ leido: true }).eq('conversacion_id', conversacionId).neq('emisor_id', miUsuario.id).eq('leido', false);
  }

  async function fetchConversaciones(uid: string) {
    const { data } = await supabase.from('conversaciones').select(`*, p1:participante1_id(id, nombre_completo), p2:participante2_id(id, nombre_completo)`).or(`participante1_id.eq.${uid},participante2_id.eq.${uid}`).order('updated_at', { ascending: false })
    setConversaciones(data || [])
  }

  async function fetchContactos() {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('id, nombre_completo, rol').neq('id', miUsuario.id)
    setContactos(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!chatActivo) return;

    fetchMensajes(chatActivo.id)
    marcarComoLeido(chatActivo.id)
    revisarMensajesNoLeidosHistoricos(miUsuario.id)

    const channel = supabase.channel(`mensajes_chat_${chatActivo.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${chatActivo.id}` }, 
      (payload) => {
        setMensajes(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        })
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [chatActivo?.id])

  async function fetchMensajes(cid: string) {
    setLoading(true)
    const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', cid).order('created_at', { ascending: true })
    setMensajes(data || [])
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    setLoading(false)
  }

  const iniciarChatCon = async (contactoId: string) => {
    const existe = conversaciones.find(c => c.participante1_id === contactoId || c.participante2_id === contactoId)
    if (existe) {
      setChatActivo(existe); setView('chat'); return;
    }
    const { data, error } = await supabase.from('conversaciones').insert([{ participante1_id: miUsuario.id, participante2_id: contactoId }]).select(`*, p1:participante1_id(id, nombre_completo), p2:participante2_id(id, nombre_completo)`).single()
    if (error) { toast.error("Error al crear chat: " + error.message); return; }
    if (data) { setConversaciones(prev => [data, ...prev]); setChatActivo(data); setView('chat'); }
  }

  const enviar = async (e?: any) => {
    if (e) e.preventDefault()
    if (!nuevoMsg.trim() || !chatActivo) return
    
    const txt = nuevoMsg
    setNuevoMsg('')
    setShowEmoji(false) 
    
    const { data, error } = await supabase.from('mensajes').insert([{ conversacion_id: chatActivo.id, emisor_id: miUsuario.id, contenido: txt }]).select().single()

    if (error) return toast.error("No se pudo enviar el mensaje")
    if (data) {
      setMensajes(prev => { if (prev.find(m => m.id === data.id)) return prev; return [...prev, data]; })
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    await supabase.from('conversaciones').update({ ultimo_mensaje: txt, updated_at: new Date().toISOString() }).eq('id', chatActivo.id)
  }

  const subirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !chatActivo) return;

      setUploadingImg(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `adjuntos/${fileName}`;

      try {
          const { error: uploadError } = await supabase.storage.from('chat').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('chat').getPublicUrl(filePath);

          const { data, error: dbError } = await supabase.from('mensajes').insert([{ 
            conversacion_id: chatActivo.id, 
            emisor_id: miUsuario.id, 
            contenido: '📷 Imagen adjunta',
            imagen_url: publicUrl
          }]).select().single();

          if (dbError) throw dbError;

          if (data) {
            setMensajes(prev => { if (prev.find(m => m.id === data.id)) return prev; return [...prev, data]; })
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
          await supabase.from('conversaciones').update({ ultimo_mensaje: '📷 Imagen enviada', updated_at: new Date().toISOString() }).eq('id', chatActivo.id);
      } catch (err: any) {
          toast.error("Error al enviar imagen");
      } finally {
          setUploadingImg(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  }

  const onEmojiClick = (emojiObject: any) => {
      setNuevoMsg(prev => prev + emojiObject.emoji)
  }

  if (!miUsuario) return null

  const otroEnChatActivoId = chatActivo?.p1?.id === miUsuario.id ? chatActivo?.p2?.id : chatActivo?.p1?.id;
  const isChatActivoOnline = usuariosConectados.includes(otroEnChatActivoId);

  return (
    <div className="fixed bottom-6 right-6 z-[99999] font-sans">
      
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto" />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={subirImagen} className="hidden" />

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-4 w-[360px] md:w-[400px] h-[600px] bg-[#f0f2f5] rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 p-4 md:p-5 text-slate-800 flex items-center justify-between shrink-0 shadow-sm z-20">
              <div className="flex items-center gap-3">
                {view !== 'lista' && <button onClick={() => { setView('lista'); setChatActivo(null); revisarMensajesNoLeidosHistoricos(miUsuario.id); setShowEmoji(false); }} className="p-2 -ml-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"><ChevronLeft size={22}/></button>}
                
                {view === 'lista' ? (
                   <h3 className="font-black uppercase tracking-tighter text-xl text-slate-900 ml-2">Mensajes</h3>
                ) : view === 'contactos' ? (
                   <h3 className="font-black uppercase tracking-tighter text-lg text-slate-900">Directorio</h3>
                ) : (
                   <div className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-600 text-white rounded-full flex items-center justify-center font-black text-sm shadow-sm">
                            {(chatActivo?.p1?.id === miUsuario.id ? chatActivo?.p2?.nombre_completo : chatActivo?.p1?.nombre_completo)?.[0] || 'U'}
                        </div>
                        {isChatActivoOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-black text-sm uppercase tracking-tight leading-none text-slate-900">
                            {chatActivo?.p1?.id === miUsuario.id ? chatActivo?.p2?.nombre_completo : chatActivo?.p1?.nombre_completo}
                        </h3>
                        <span className={`text-[10px] font-bold tracking-widest mt-1 ${isChatActivoOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                           {isChatActivoOnline ? 'En línea' : 'Desconectado'}
                        </span>
                      </div>
                   </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {view === 'lista' && <button onClick={() => { setView('contactos'); fetchContactos(); }} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" title="Nuevo chat"><MessageSquarePlus size={22} strokeWidth={2.5}/></button>}
                <button onClick={() => { setIsOpen(false); revisarMensajesNoLeidosHistoricos(miUsuario.id); setShowEmoji(false); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={22}/></button>
              </div>
            </div>

            {/* 🔥 AQUÍ ESTÁ EL ARREGLO DEL SCROLL: overscroll-contain 🔥 */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 custom-scrollbar text-slate-900 relative overscroll-contain">
              
              {view === 'lista' && (
                <div className="space-y-2">
                  {conversaciones.length === 0 ? (
                    <div className="text-center mt-24 space-y-4">
                      <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2"><MessageSquareText size={32} /></div>
                      <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Bandeja Vacía</p>
                      <button onClick={() => { setView('contactos'); fetchContactos(); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-transform">Iniciar Conversación</button>
                    </div>
                  ) : (
                    conversaciones.map(c => {
                      const otro = c.participante1_id === miUsuario.id ? c.p2 : c.p1;
                      const isOnline = usuariosConectados.includes(otro?.id);

                      return (
                        <button key={c.id} onClick={() => { setChatActivo(c); setView('chat'); setUnread(false); }} className="w-full bg-white p-4 rounded-3xl border border-slate-100 hover:border-blue-300 transition-all flex items-center gap-4 text-left shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md group">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all font-black text-lg">
                               {otro?.nombre_completo?.[0] || 'U'}
                            </div>
                            {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                               <p className="font-black uppercase text-xs text-slate-800 truncate group-hover:text-blue-600 transition-colors">{otro?.nombre_completo || 'Usuario'}</p>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate font-medium">{c.ultimo_mensaje || 'Toca para conversar...'}</p>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {view === 'contactos' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Personal Clínico</p>
                  {loading ? <Loader2 className="animate-spin mx-auto text-blue-500 mt-10" /> : (
                    contactos.map(c => {
                      const isOnline = usuariosConectados.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => iniciarChatCon(c.id)} className="w-full bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all flex items-center gap-4 text-left shadow-sm">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-black">{c.nombre_completo?.[0] || 'U'}</div>
                            {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>}
                          </div>
                          <div>
                            <p className="font-black uppercase text-xs text-slate-800 leading-none">{c.nombre_completo}</p>
                            <p className="text-[9px] text-blue-500 font-black uppercase mt-1.5">{c.rol}</p>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {view === 'chat' && (
                <div className="space-y-4 pb-2 flex flex-col pt-2" onClick={() => setShowEmoji(false)}>
                  {loading ? <Loader2 className="animate-spin mx-auto mt-10 text-blue-500" /> : mensajes.map(m => (
                    <div key={m.id} className={`flex w-full ${m.emisor_id === miUsuario.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3.5 text-[13px] font-medium shadow-sm leading-relaxed break-words relative 
                          ${m.emisor_id === miUsuario.id 
                            ? 'bg-[#E3F2FD] text-slate-800 rounded-2xl rounded-br-sm border border-[#bfdbfe]' 
                            : 'bg-white text-slate-800 rounded-2xl rounded-bl-sm border border-slate-200'}`}>
                        
                        {m.imagen_url && (
                            <div className="mb-2 overflow-hidden rounded-xl bg-black/5 flex justify-center border border-black/5">
                               <img src={m.imagen_url} alt="Adjunto" className="max-w-full h-auto object-cover hover:opacity-90 transition-opacity cursor-pointer" onClick={() => window.open(m.imagen_url, '_blank')} />
                            </div>
                        )}

                        {m.contenido !== '📷 Imagen adjunta' && (
                            <span className="block mt-0.5">{m.contenido}</span>
                        )}

                        <span className={`block text-[9px] font-bold mt-1.5 text-right opacity-50 ${m.emisor_id === miUsuario.id ? 'text-slate-600' : 'text-slate-500'}`}>
                          {formatFechaAmigable(m.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {uploadingImg && (
                      <div className="flex w-full justify-end">
                         <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 rounded-br-sm flex items-center gap-2">
                             <Loader2 size={14} className="animate-spin text-blue-600" />
                             <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Enviando...</span>
                         </div>
                      </div>
                  )}

                  <div ref={scrollRef} className="h-2 w-full shrink-0" />
                </div>
              )}
            </div>

            {view === 'chat' && (
              <div className="relative bg-slate-100/50 border-t border-slate-200 p-3 md:p-4 shrink-0 z-30">
                
                {/* 🔥 SOLUCIÓN DE EMOJIS: emojiStyle="native" 🔥 */}
                {showEmoji && (
                   <div className="absolute bottom-[110%] mb-2 left-4 right-4 md:left-4 md:right-auto z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                      <EmojiPicker 
                         onEmojiClick={onEmojiClick} 
                         theme={Theme.LIGHT} 
                         emojiStyle={EmojiStyle.NATIVE} 
                         searchDisabled={false} 
                         skinTonesDisabled 
                         width="100%" 
                         height={320} 
                      />
                   </div>
                )}

                <form onSubmit={enviar} className="flex items-center gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-sm">
                  
                  <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors shrink-0" title="Emojis">
                     <Smile size={22} strokeWidth={2} />
                  </button>

                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0" title="Adjuntar Imagen">
                     <Paperclip size={20} strokeWidth={2} className="rotate-45" />
                  </button>

                  <input autoFocus value={nuevoMsg} onChange={e => setNuevoMsg(e.target.value)} placeholder="Escribe un mensaje..." className="flex-1 bg-transparent px-2 py-2 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400" />
                  
                  <button type="submit" disabled={(!nuevoMsg.trim() && !uploadingImg)} className="w-10 h-10 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center hover:bg-blue-600 transition-all disabled:opacity-50 disabled:scale-95 shrink-0 shadow-md">
                     <Send size={18} className="ml-0.5 pointer-events-none" strokeWidth={2.5}/>
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => { 
            setIsOpen(!isOpen); 
            if (isOpen) {
               revisarMensajesNoLeidosHistoricos(miUsuario.id); 
               setShowEmoji(false);
            } else {
               setUnread(false); 
            }
        }}
        className={`w-[65px] h-[65px] rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 relative z-50 
          ${isOpen ? 'bg-slate-900 text-white rotate-90 shadow-none' : 'bg-slate-900 text-white hover:bg-black hover:-translate-y-1 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.5)]'}
          ${unread && !isOpen ? 'ring-[6px] ring-red-500/20' : ''}
        `}
      >
        {isOpen ? <X size={28} /> : <MessageSquareText size={28} strokeWidth={2.5} />}
        
        {unread && !isOpen && (
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-[3px] border-white shadow-sm"></span>
          </span>
        )}
      </button>
    </div>
  )
}
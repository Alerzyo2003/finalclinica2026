'use server'
import { createClient } from '@supabase/supabase-js'

// Cliente administrativo de Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const VIRTUAL_DOMAIN = "@dentapro.com";

// --- FUNCIÓN PARA CREAR ---
export async function crearCuentaProfesional(formData: any) {
  const { nombre, apellido, username, password, rol, especialidad_id, rut } = formData;
  const nombreCompleto = `${nombre} ${apellido}`;
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9.]/g, "");
  const virtualEmail = `${cleanUsername}${VIRTUAL_DOMAIN}`;
  let authUserId: string | null = null;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: password,
      email_confirm: true,
      user_metadata: { nombre_completo: nombreCompleto, rol: rol, username: cleanUsername, rut: rut }
    })
    if (authError) return { error: `Error Auth: ${authError.message}` };
    authUserId = authData.user.id;

    await supabaseAdmin.from('perfiles').upsert([{ 
      id: authUserId, nombre_completo: nombreCompleto, rol: rol, username: cleanUsername, rut: rut 
    }])
    
    if (rol === 'DENTISTA') {
      await supabaseAdmin.from('profesionales').upsert([{
        user_id: authUserId, nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(),
        especialidad_id: especialidad_id || null, activo: true
      }])
    }
    return { success: true }
  } catch (error: any) {
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);
    return { error: error.message }
  }
}

// --- FUNCIÓN PARA ACTUALIZAR ---
export async function actualizarCuentaProfesional(id: string, userId: string, formData: any) {
  try {
    const { nombre, apellido, especialidad_id, rol, rut } = formData;
    const nombreCompleto = `${nombre} ${apellido}`
    
    // El 'userId' es el ID de la tabla Auth de Supabase
    await supabaseAdmin.from('perfiles').update({ 
      nombre_completo: nombreCompleto, rol: rol, rut: rut 
    }).eq('id', userId)
    
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { nombre_completo: nombreCompleto, rol: rol, rut: rut }
    });

    if (rol === 'DENTISTA') {
      await supabaseAdmin.from('profesionales').update({
        nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(),
        especialidad_id: especialidad_id || null
      }).eq('user_id', userId)
    }
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

/**
 * --- FUNCIÓN PARA ELIMINAR ---
 * Modificada para aceptar 1 o 2 argumentos y evitar el error "Expected 1 arguments, but got 2"
 */
export async function eliminarCuentaProfesional(idOrUserId: string, secondaryId?: string) {
  try {
    // Si recibimos dos IDs, el importante para Auth suele ser el segundo (user_id)
    // Si solo recibimos uno, usamos ese.
    const targetId = secondaryId || idOrUserId;

    if (!targetId) throw new Error("ID de usuario no proporcionado");

    // 1. Eliminar de tablas relacionales primero
    await supabaseAdmin.from('profesionales').delete().eq('user_id', targetId);
    await supabaseAdmin.from('perfiles').delete().eq('id', targetId);
    
    // 2. Eliminar de Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (authErr) throw authErr;

    return { success: true }
  } catch (err: any) {
    console.error("Error en eliminarCuentaProfesional:", err.message);
    return { error: err.message }
  }
}

// --- ALIAS DE COMPATIBILIDAD ---
export const crearCuentaStaff = crearCuentaProfesional;
export const actualizarCuentaStaff = actualizarCuentaProfesional;
export const eliminarCuentaStaff = eliminarCuentaProfesional;

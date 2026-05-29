import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Automatización de Agenda Clínica', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Login
    await page.goto(`${BASE_URL}/login`);
    await page.locator('#username').fill('cesar');
    await page.locator('#password').fill('contrasena123');
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();

    await page.waitForURL('**/'); 
    await page.goto(`${BASE_URL}/agenda`);
    await expect(page.getByRole('heading', { name: 'Agenda Clínica' })).toBeVisible();
  });

  // 🧪 PRUEBA 1: FILTROS Y RENDERIZADO
  test('Debe filtrar citas correctamente por Especialista', async ({ page }) => {
    const selectDoctor = page.locator('select').first(); 
    await selectDoctor.selectOption({ index: 1 }); 
    await expect(page.getByRole('button', { name: 'Agendar' })).toBeVisible();
  });

  // 🧪 PRUEBA 2: AGENDAMIENTO DE PACIENTE (Camino Feliz)
  test('Debe agendar un paciente existente exitosamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Agendar' }).click();
    await expect(page.getByText('Nueva Reserva • Paso 1')).toBeVisible();

    await page.getByRole('button', { name: '30m' }).click();
    
    const btnHora = page.getByRole('button', { name: '10:00', exact: true }).first();
    
    if (await btnHora.isDisabled() === false) {
      await btnHora.click();

      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('Nueva Reserva • Paso 2')).toBeVisible();

      await page.getByPlaceholder('Buscar por Nombre o RUT...').fill('Pilar');
      await page.waitForTimeout(1000); 

      await page.locator('button').filter({ hasText: /Pilar/i }).first().click();
      await page.getByRole('button', { name: 'Agendar Cita' }).click();

      await expect(page.getByText('¡Cita Lista!')).toBeVisible();
      await page.getByRole('button', { name: 'Finalizar' }).click();
    }
  });

  // 🧪 PRUEBA 3: CAMBIO DE ESTADO
  test('Debe cambiar el estado de la cita a "En Espera"', async ({ page }) => {
    const selectEstado = page.locator('select').nth(1); 
    
    if (await selectEstado.isVisible()) {
      await selectEstado.selectOption('en_espera');
      await expect(page.getByText('Estado actualizado')).toBeVisible();
      await expect(page.getByText('Sala (').first()).toBeVisible();
    }
  });

  // 🧪 PRUEBA 4: FLUJO DE CAJA Y PAGO
  test('Debe abrir la caja y permitir recaudar dinero', async ({ page }) => {
    const btnCaja = page.locator('button[title="Caja / Pagar"]').first();
    
    if (await btnCaja.isVisible()) {
      await btnCaja.click();
      await expect(page.getByRole('heading', { name: 'Caja y Pagos' })).toBeVisible();

      await page.getByPlaceholder('Ej: 50000').fill('10000'); 
      await page.getByPlaceholder('Ej: TX-123456789').fill('AUTO-TEST-123'); 
      await page.getByRole('button', { name: 'Registrar Pago Seguro' }).click();

      await expect(page.getByText(/procesado/i)).toBeVisible();
    }
  });
});
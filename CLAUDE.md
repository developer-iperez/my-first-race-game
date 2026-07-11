# Guía de trabajo para Claude en este repo

Proyecto: juego de rally 2D (Phaser 3 + TypeScript), desarrollo iterativo
con feedback constante del usuario probando en móvil. Ver `docs/ROADMAP.md`
(estado por fases) y `docs/ANALISIS.md` (razonamiento de arquitectura).

## Reglas de eficiencia (importante — pedido explícito del usuario)

Esta sesión ha tenido un consumo de tokens alto. Estas reglas están para
evitar que se repita:

1. **No comprobar el deploy de GitHub Actions automáticamente tras cada
   push.** La consulta al historial de workflow runs devuelve payloads de
   cientos de miles de caracteres cuando solo hace falta el estado del
   último run. Basta con confirmar que el `git push` ha ido bien y decir
   "pusheado, desplegando". Comprobar el workflow solo si el usuario lo
   pide explícitamente o si hay motivo concreto para sospechar un fallo.

2. **CHANGELOG.md: entradas cortas.** 2-4 líneas por cambio, sin narrativa
   de "verificado en directo paso a paso" ni explicaciones extensas del
   porqué de cada decisión — esa razón, si hace falta recuperarla, está en
   el historial de commits (los mensajes de commit sí pueden ser más
   detallados). Agrupar por versión (v0.1, v0.2...), no por
   Added/Fixed/Changed repetido en cada entrada.

3. **Verificación proporcional al riesgo, no exhaustiva por defecto.**
   - Cambios de lógica pura (físicas, `LapTracker`, utilidades): confiar en
     los tests de Vitest existentes/nuevos. No hace falta además un ciclo
     completo de Playwright + capturas de pantalla si los tests ya cubren
     el comportamiento.
   - Reservar la verificación en navegador real (con o sin capturas) para
     cambios de UX/visuales/inputs que los tests unitarios no pueden
     comprobar (foco del teclado, gestos táctiles, aspecto visual).
   - Al tunear parámetros numéricos por simulación, no imprimir cada paso
     de un barrido — calcular y mostrar solo los valores finales elegidos
     y una comprobación de que cumplen la condición buscada.

4. **Agrupar comandos de verificación.** Encadenar
   `tsc -b && lint && vitest run && build` en una sola llamada en vez de
   cuatro llamadas separadas con salida verbosa cada una.

## Convenciones del proyecto (resumen — detalle en docs/ANALISIS.md)

- **Diseño por datos**: circuitos y coches son JSON validados con Zod
  (`public/tracks/*.json`, `public/cars/*.json`); no hardcodear valores de
  un circuito/coche concreto en el código.
- **Físicas puras**: `src/physics/carPhysics.ts` es una función pura
  (mismo estado+input+dt → mismo resultado), fácil de testear y simular
  sin montar Phaser.
- Antes de dar por bueno un cambio en `carPhysics.ts`, simular el bucle a
  `dt` real (~1/60s, muchos pasos) en vez de un único paso con `dt` grande
  — un efecto que se ve claro en un salto grande puede desvanecerse en el
  juego real (ya ha pasado, ver CHANGELOG v0.4).

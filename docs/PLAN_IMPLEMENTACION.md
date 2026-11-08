# Plan de implementación — Rally 90s

> Origen: [`docs/AUDITORIA.md`](./AUDITORIA.md)
> Fecha: 2026-11-08
> Estado: Sprint 1 completo y S2.1–S2.5 implementados. S2.6 (fantasma y rejugabilidad) es el siguiente.
> Objetivo: pasar de prototipo técnico a un rally arcade divertido, legible,
> rejugable y con identidad de pixel art noventero.

---

## 1. Objetivo y alcance

### 1.1 Objetivo

Convertir el juego actual en una experiencia en la que:

- conducir sea divertido por sí solo, incluso sin cronómetro;
- derrapar sea una decisión del jugador, no el estado por defecto;
- los circuitos se lean de un vistazo y no se puedan cortar;
- una carrera dure 2–3 minutos y dé ganas de repetir;
- la estética, la UI y el audio tengan una identidad 90s coherente;
- el juego sea cómodo en móvil y en escritorio.

### 1.2 Fuera de alcance de este plan

- Multijugador online.
- Editor visual de circuitos propio (se sigue usando Tiled).
- 3D, cámara isométrica completa o motor nuevo.
- IA de rivales compleja.
- Backend, cuentas o leaderboard online.
- Varios coches jugables (se deja preparado el dato, pero no es objetivo de
  esta iteración).

### 1.3 Principios

1. **No cambiar el stack.** Phaser 3 + TypeScript + Vite + Tiled + Zod +
   Vitest siguen siendo la base. El problema es el diseño, no el motor.
2. **Físicas puras y testeables.** `carPhysics.ts` sigue siendo una función
   determinista; las colisiones también serán un módulo puro.
3. **Móvil primero.** Cada cambio de UI/feel se prueba en 844×390 y en un
   móvil real antes de darlo por bueno.
4. **Datos, no hardcode.** Circuitos, coches, tuning y textos de UI viven en
   datos o en un catálogo centralizado.
5. **Una cosa por fase.** No mezclar rediseño de circuitos con retuning de
   físicas en el mismo PR.
6. **Medir, no opinar.** Cada cambio de feel se valida con el simulador y con
   una prueba jugada.

---

## 2. Punto de partida y metas medibles

### 2.1 Métricas actuales vs objetivo

| Métrica | Hoy | Objetivo |
|---|---:|---:|
| 0 → 100% velocidad | 0,37 s | 0 → 90% en 2,5–4 s |
| Frenada 100% → 0 | 0,13 s / 16 px | 0,6–1,0 s / 120–200 px |
| Soltar gas 1 s | pierde 70% | conservar 70–80% |
| Radio de giro lento | 96 px | 60–80 px |
| Radio de giro rápido | 96 px | 140–200 px |
| Derrape a fondo + gas | 68% lateral | 25–40% lateral |
| Freno de mano | 100% lateral | 45–60% lateral |
| Recuperación del derrape | brusca | 0,3–0,5 s |
| Muro central de 128 px | atravesado en 0,88 s | imposible de atravesar |
| Arena | grip 1 / drag 1 | grip 0,7–0,8 / drag 1,1–1,2 |
| Vuelta | ~4,9 s teóricos | 25–45 s |
| Carrera | ~15 s teóricos | 2–3 min |
| Framerate | sin paso fijo | paso fijo 60/120 Hz |

### 2.2 Criterios de éxito globales

- [ ] Se puede dar una vuelta sin tocar un muro y sin sensación de “hielo”.
- [ ] Se puede provocar un derrape con freno de mano y recuperarlo.
- [ ] Ningún muro se atraviesa a ninguna velocidad.
- [ ] Las 3 pistas se sienten distintas y no se pueden cortar.
- [ ] Una carrera completa dura entre 2 y 3 minutos.
- [ ] El HUD se lee en 844×390 y en escritorio.
- [ ] Un jugador nuevo entiende los controles sin leer el README.
- [ ] 60 fps estables en un móvil de gama media.
- [ ] Todos los circuitos pasan validación de contenido.
- [ ] `lint`, `test`, `build` y `validate` pasan en CI.

---

## 3. Arquitectura objetivo

### 3.1 Flujo por frame

```
Entrada (teclado + táctil + gamepad)
        ↓
InputManager (rampa, zona muerta, bindings)
        ↓
Bucle de paso fijo (acumulador, 60/120 Hz)
        ↓
carPhysics (motor, freno, giro, derrape)
        ↓
carCollision (cápsula del coche contra tiles)
        ↓
TrackQuery (grip/drag por rueda, gate, superficie)
        ↓
Estado del coche + eventos (impacto, derrape, superficie)
        ↓
Render / HUD / Audio / Partículas / Ghost
```

### 3.2 Módulos nuevos o muy afectados

| Módulo | Estado | Responsabilidad |
|---|---|---|
| `src/physics/carPhysics.ts` | Reescribir | Modelo de conducción con peso, arrastre y derrape controlable |
| `src/physics/carCollision.ts` | Nuevo | Cápsula del coche contra tiles, deslizamiento y eventos |
| `src/physics/fixedStep.ts` | Nuevo | Acumulador de paso fijo y clamp de delta |
| `src/physics/feelMetrics.ts` | Nuevo | Simulación de métricas para tests y tuning |
| `src/track/TrackQuery.ts` | Ampliar | Muestreo por rueda, gate, superficie y paredes |
| `src/race/LapTracker.ts` | Reescribir | Puertas con anchura/dirección, anti-corte, wrong-way |
| `src/race/RaceHud.ts` | Ampliar | Velocímetro, RPM, marcha, delta, derrape |
| `src/race/RaceResults.ts` | Nuevo | Resultados, vueltas, medallas y botones |
| `src/race/PauseMenu.ts` | Nuevo | Pausa, reinicio, salir |
| `src/race/GhostRecorder.ts` | Nuevo | Grabar la mejor vuelta |
| `src/race/GhostPlayer.ts` | Nuevo | Reproducir el fantasma |
| `src/input/InputManager.ts` | Nuevo | Unificar teclado, táctil y gamepad |
| `src/input/TouchControls.ts` | Reescribir | Layout móvil, multi-touch, safe areas |
| `src/audio/EngineAudio.ts` | Nuevo | Motor con RPM/marcha/carga |
| `src/audio/SkidAudio.ts` | Nuevo | Derrape con pitch/volumen |
| `src/ui/theme.ts` | Nuevo | Paleta, fuentes, paneles y escala de UI |
| `src/ui/strings.ts` | Nuevo | Textos centralizados y localización |
| `src/settings/Settings.ts` | Ampliar | Presets, volúmenes, accesibilidad, bindings |
| `src/track/TiledMapAdapter.ts` | Ampliar | GATES, medallas, temas y capas decorativas |

### 3.3 Decisiones técnicas

- **Paso fijo:** 120 Hz con acumulador. Delta máximo aceptado: 0,25 s.
  Máximo de subpasos por frame: 8. Reiniciar el acumulador al pausar.
- **Colisión:** cápsula de 3 círculos (frontal, centro, trasero) usando
  `appearance.wheelbaseOffset` y `physics.width`. Sweep contra la rejilla de
  muros, corrección de posición y proyección de velocidad. Eventos de impacto
  para audio/partículas.
- **Superficies:** muestrear 4 ruedas (delantera/trasera × izquierda/derecha).
  Grip = media ponderada; drag = media. Si una rueda está fuera de pista, se
  nota. `surfaceKey` se usa para polvo, sonido y marcas.
- **Gates:** cada checkpoint tiene `x, y, angle, width`. Se detecta cruce de
  segmento con la posición anterior y actual, no un círculo de radio.
- **Cámara:** se mantiene fija y con el circuito completo visible (requisito
  F3). La legibilidad móvil se resuelve con coche más grande, HUD escalado y
  controles fuera del área de juego. Un modo “cámara cercana” queda como
  experimento opcional, no como default.
- **UI:** HUD y menús de juego con fuente bitmap/pixel y paneles propios. El
  panel DOM de ajustes se mantiene por accesibilidad, pero se reestiliza.
- **Renderer:** se mantiene Canvas 2D de momento. Antes de añadir muchos
  efectos se benchmarkea WebGL; si el bug de Chrome Android se reproduce, se
  queda Canvas como fallback y se limitan partículas.
- **Persistencia:** claves versionadas para ajustes, récords y fantasmas.
  Récords por circuito + coche + preset de tuning.

---

## 4. Fases y tareas

Leyenda de esfuerzo relativo: **S** = sesión corta, **M** = 1–2 sesiones,
**L** = varias sesiones. No son fechas, son tamaños para ordenar.

---

## Sprint 1 — Feel: hacer que conducir se sienta bien (P0)

**Meta del sprint:** que coger el coche y dar una vuelta sea divertido por sí
solo, sin muros atravesables y sin frenadas de teletransporte.

**Criterio de salida:** métricas de la tabla 2.1 dentro de rango, HUD con
velocidad, input con rampa y tests de feel en verde.

### ✅ S1.1 — Baseline y simulador de métricas

**Objetivo:** medir antes de tocar para no tunear a ciegas.

**Cambios:**
- `scripts/feel-metrics.ts`: simula 0→velocidad, frenada, coasting, radio de
  giro, derrape, freno de mano y cruce de muro.
- `package.json`: script `npm run feel`.
- `tests/feelMetrics.test.ts`: tolerancias de las métricas objetivo.
- `docs/AUDITORIA.md`: conservar la tabla actual como referencia histórica.

**Criterios de aceptación:**
- [ ] `npm run feel` imprime todas las métricas en una tabla.
- [ ] El script usa el tuning real por defecto (settings + JSON del coche).
- [ ] Los tests fallan si una métrica se sale del rango objetivo.
- [ ] Se puede ejecutar sin Phaser ni navegador.

**Depende de:** nada.
**Esfuerzo:** S.

### ✅ S1.2 — Paso de física fijo

**Objetivo:** que el juego se comporte igual a 30, 60 o 144 fps y no se
atraviesen muros tras un tirón de framerate.

**Cambios:**
- `src/physics/fixedStep.ts`: acumulador con `dt` fijo, clamp de delta y
  máximo de subpasos.
- `src/scenes/RaceScene.ts`: sustituir `deltaMs` directo por el acumulador.
- Pausa automática en `visibilitychange` y `blur`.
- Tests: `tests/fixedStep.test.ts`.

**Detalle:**
- `PHYSICS_HZ = 120`, `FIXED_DT = 1/120`.
- `MAX_FRAME_DELTA = 0.25`.
- `MAX_SUBSTEPS = 8`.
- Al reanudar, resetear el acumulador para evitar un salto.
- La renderización usa el estado más reciente; no hace falta interpolación en
  pixel art a 60 fps.

**Criterios de aceptación:**
- [ ] 30, 60 y 144 fps producen la misma distancia tras 2 s de aceleración.
- [ ] Un frame de 2 s no mueve el coche más de lo permitido por el clamp.
- [ ] Al cambiar de pestaña no hay salto ni túnel.
- [ ] El juego se pausa solo al perder foco.

**Depende de:** nada.
**Esfuerzo:** M.

### ✅ S1.3 — Colisión sólida del coche

**Objetivo:** que los muros sean muros, no arenas movedizas.

**Cambios:**
- `src/physics/carCollision.ts`: cápsula de 3 círculos, sweep contra tiles,
  resolución de contacto, deslizamiento y eventos.
- `src/track/TrackQuery.ts`: helper para obtener tiles de muro en un AABB.
- `src/scenes/RaceScene.ts`: integrar la resolución y consumir eventos de
  impacto, polvo y sonido.
- Tests: `tests/carCollision.test.ts`.

**Detalle:**
- Cápsula: centros a `±(length/2 - width/2)` y `0`, radio `physics.width / 2`.
- Sweep de cada círculo contra AABB de tiles; elegir el impacto más temprano.
- Resolver posición, proyectar velocidad sobre la normal, aplicar restitución
  baja (0,12) y conservar la componente tangencial.
- Iterar hasta 5 contactos para esquinas.
- Evento `{ normal, impactSpeed, point }` para audio/partículas.
- El reset a la última puerta/posición segura se implementa en S2.5.

**Criterios de aceptación:**
- [ ] A velocidad máxima no se atraviesa un muro de 32 px ni uno de 128 px.
- [ ] El coche desliza contra la pared en ángulo, no se queda pegado.
- [ ] No hay vibración ni teletransporte al resolver esquinas.
- [ ] Un impacto fuerte genera polvo y sonido.
- [ ] El coche nunca queda dentro de un muro sin salida.

**Depende de:** S1.2.
**Esfuerzo:** L.

### ✅ S1.4 — Re-tuning del modelo de conducción

**Objetivo:** dar peso al coche y convertir el derrape en una acción
controlable.

**Cambios:**
- `src/config/schema/car.ts`: nuevos campos de física (o defaults internos).
- `public/cars/rally-hatch.json`: valores nuevos.
- `src/settings/carTuning.ts`: defaults y presets.
- `src/physics/carPhysics.ts`: modelo de motor, freno, arrastre, giro y
  derrape.
- `src/physics/feelMetrics.ts`: métricas nuevas.
- `tests/carPhysics.test.ts`: actualizar tests al comportamiento deseado.

**Detalle propuesto:**
- **Motor:** fuerza con curva de par que cae con la velocidad; 0→90% en
  2,5–4 s. El `maxSpeed` deja de ser el único limitador.
- **Arrastre:** resistencia a la rodadura baja + arrastre aerodinámico
  cuadrático. Soltar gas 1 s conserva 70–80%.
- **Freno:** desaceleración real; 100%→0 en 0,6–1,0 s. Marcha atrás solo tras
  detenerse y mantener atrás 0,15–0,25 s.
- **Volante:** rampa de entrada de 0,12–0,2 s (en `InputManager`), objetivo de
  yaw con subviraje progresivo según velocidad.
- **Agarre lateral:** base alta, pérdida progresiva por volante y velocidad.
  Full lock no debe llevar el agarre a 0,05; suelo normal 0,25–0,35, freno de
  mano 0,08–0,15.
- **Derrape:** equilibrio 25–40% lateral; recuperación 0,3–0,5 s.
- **Flick:** impulso máximo 0,25–0,35 de la velocidad, con cooldown y sin
  escalar todo el vector de velocidad.
- **Telemetría:** añadir `slipAngle`, `forwardSpeed`, `lateralSpeed`, `gear`,
  `surfaceKey` y `collision` al HUD de debug.

**Criterios de aceptación:**
- [ ] Métricas de la tabla 2.1 dentro de rango.
- [ ] El coche se siente con peso al acelerar, frenar y girar.
- [ ] Se puede provocar un derrape y recuperarlo sin trompo.
- [ ] El freno de mano no detiene el coche de golpe.
- [ ] Soltar gas no es equivalente a frenar.
- [ ] Los tests de física siguen pasando y los nuevos tests de feel también.

**Depende de:** S1.1, S1.2.
**Esfuerzo:** L.

### ✅ S1.5 — Superficies reales y muestreo por rueda

**Objetivo:** que hierba, arena y asfalto se noten de verdad.

**Cambios:**
- `src/track/TrackQuery.ts`: `getSurfaceAt`, `sampleCarSurfaces` (4 ruedas).
- `src/track/TiledMapAdapter.ts`: exigir `grip` y `drag` para toda superficie
  usada; error claro si falta.
- `public/tracks/*.json`: definir arena/tierra/hierba con valores distintos.
- `src/entities/Car.ts`: aceptar muestra de superficie.
- `src/race/SkidParticles.ts`: color/tamaño según superficie.
- `tests/trackQuery.test.ts` y `tests/surfaces.test.ts`.

**Detalle:**
- Puntos de rueda: `±wheelbaseOffset` en longitudinal y `±width/2` en lateral.
- Grip efectivo: media; drag: media.
- Valores propuestos: asfalto 1,0/1,0; hierba 0,65/1,06; arena 0,75/1,12;
  tierra 0,8/1,08.
- Si una rueda está fuera de pista, el coche debe notarlo (no solo el centro).

**Criterios de aceptación:**
- [ ] La arena de Duna Veloz frena y derrapa distinto que el asfalto.
- [ ] Cruzar de asfalto a hierba cambia el comportamiento de forma visible.
- [ ] Todas las superficies referenciadas tienen `grip` y `drag`.
- [ ] Los tests de contenido fallan si falta una definición.

**Depende de:** S1.4.
**Esfuerzo:** M.

### ✅ S1.6 — Input con rampa, WASD y gamepad

**Objetivo:** que el volante no sea un interruptor y que el juego sea cómodo
con teclado, mando y táctil.

**Cambios:**
- `src/input/InputManager.ts`: unificar fuentes, rampa y zona muerta.
- `src/input/TouchControls.ts`: layout y pointer capture.
- `src/scenes/RaceScene.ts`: usar `InputManager` en lugar de leer teclas
  directamente.
- `tests/input.test.ts`.

**Detalle:**
- Teclado: flechas + WASD; Space freno de mano; R reset; P/Esc pausa.
- Gamepad: ejes analógicos para volante/gas, botones para freno de mano.
- Rampa de volante: 0 → 1 en ~0,15 s; retorno más rápido.
- Zona muerta de 0,15 para ejes analógicos.
- Táctil: botones con rampa (no analógico en esta fase) y `setPointerCapture`.
- Evitar que una tecla quede “pegada” al perder foco.

**Criterios de aceptación:**
- [ ] WASD y flechas funcionan simultáneamente.
- [ ] El gamepad se detecta y se puede conducir con él.
- [ ] Pulsar y soltar rápido no deja el volante a fondo.
- [ ] En táctil se puede acelerar y girar con dedos distintos.
- [ ] Al cambiar de ventana no quedan teclas atascadas.

**Depende de:** S1.4 (para probar el feel con rampa).
**Esfuerzo:** M.

### ✅ S1.7 — HUD de conducción: velocidad, RPM, marcha y derrape

**Objetivo:** que el jugador sepa a qué velocidad va y qué está haciendo el
coche.

**Cambios:**
- `src/race/RaceHud.ts`: velocímetro, RPM, marcha, delta de vuelta, indicador
  de derrape.
- `src/race/formatSpeed.ts` o helper equivalente.
- `src/race/DriveTelemetryHud.ts`: ampliar con las nuevas métricas.
- `tests/formatTime.test.ts` / nuevo `tests/hud.test.ts`.

**Detalle:**
- Velocidad mostrada: `px/s → km/h` con factor de escala del juego (propuesta:
  0,5; 312 px/s ≈ 156 km/h).
- Marcha: 5 marchas derivadas de la velocidad normalizada.
- RPM: interpolación dentro de la marcha.
- Delta: diferencia con la mejor vuelta en el mismo punto, en vivo.
- Derrape: barra o icono que se enciende con `slipRatio > 0,35`.

**Criterios de aceptación:**
- [ ] La velocidad cambia de forma visible al acelerar/frenar.
- [ ] La marcha sube y baja con la velocidad.
- [ ] El delta se actualiza cada frame y es legible.
- [ ] El HUD no tapa el circuito ni los controles.
- [ ] En 844×390 se lee sin ampliar.

**Depende de:** S1.4.
**Esfuerzo:** M.

### ✅ S1.8 — Tests de aceptación y contenido

**Objetivo:** que las mejoras no se rompan en silencio.

**Cambios:**
- `tests/feelMetrics.test.ts`: 0→90%, frenada, coasting, radio, derrape,
  recuperación.
- `tests/carCollision.test.ts`: muro, esquina, alta velocidad, deslizamiento.
- `tests/fixedStep.test.ts`: framerate y clamp.
- `tests/trackContent.test.ts`: superficies, spawn, puertas, muros, longitud.
- `scripts/validate-content.mjs` o test equivalente.
- CI: añadir `npm run validate` antes de `build`.

**Criterios de aceptación:**
- [ ] Todos los tests pasan.
- [ ] Un muro atravesable rompe un test.
- [ ] Una superficie sin `grip`/`drag` rompe un test.
- [ ] Un circuito sin muros o con spawn inválido rompe un test.
- [ ] CI ejecuta los tests de contenido.

**Depende de:** S1.3–S1.5.
**Esfuerzo:** M.

---

## Sprint 2 — Circuitos y bucle de carrera (P1)

**Meta del sprint:** que el escenario y las reglas estén a la altura del nuevo
feel: 3 circuitos distintos, 2–3 minutos de carrera, checkpoints que no se
puedan cortar y una pantalla de resultados.

**Criterio de salida:** 3 pistas jugables y distintas, con gates, anti-corte,
resultados, pausa y récords coherentes.

### ✅ S2.1 — Diseño de los 3 circuitos

**Objetivo:** definir la identidad y el ritmo de cada pista antes de dibujar.

**Cambios:**
- `docs/DISENO_CIRCUITOS.md` con:
  - plano/esquema de cada circuito;
  - longitud objetivo y tiempo de vuelta;
  - anchura de pista, radios, zonas de derrape;
  - mezcla de superficies;
  - situación de gates y meta;
  - elementos de referencia visual (árboles, rocas, dunas, vallas);
  - tiempos de medalla.
- `docs/TILED.md` con las convenciones de capas y propiedades.

**Propuesta de identidad:**

| Circuito | Tema | Carácter | Vuelta | Vueltas |
|---|---|---|---:|---:|
| Bosque Bravo | Bosque | Técnico, mixto asfalto/tierra, curvas de varios radios | 35–45 s | 3 |
| Duna Veloz | Desierto | Rápido, amplio, derrapes largos sobre arena | 30–40 s | 4 |
| Serpiente | Cañón/valle | Ratonero, chicanes, muros cerca, precisión | 30–35 s | 3 |

**Criterios de aceptación:**
- [ ] Cada circuito tiene un esquema y una identidad clara.
- [ ] Ninguno reutiliza el layout de otro.
- [ ] La longitud objetivo da 2–3 min de carrera.
- [ ] Los gates están colocados antes de cada zona crítica.
- [ ] Hay una lista de assets necesarios por tema.

**Depende de:** S1.4 (velocidad objetivo).
**Esfuerzo:** S.

### ✅ S2.2 — Autoría de circuitos en Tiled

**Objetivo:** construir los 3 circuitos nuevos con la calidad visual y jugable
del plan.

**Cambios:**
- `public/tracks/rally-01.json`, `rally-02.json`, `rally-03.json`: mapas
  nuevos.
- Capas nuevas:
  - `surface` (visible): asfalto, tierra, arena, hierba.
  - `walls` (lógica): muros y bordes.
  - `decor` (visual): árboles, rocas, vallas, señales.
  - `waypoints` (objetos): spawn, start_finish y gates con `angle`/`width`.
- `src/track/TrackRenderer.ts`: renderizar capas decorativas.
- `src/track/TiledMapAdapter.ts`: leer medallas y props nuevas.
- `src/scenes/BootScene.ts`: cargar tilesets por tema.
- `scripts/convert-track-to-tiled.mjs`: archivar o eliminar si ya no se usa.

**Criterios de aceptación:**
- [ ] Los 3 circuitos cargan y se renderizan sin huecos.
- [ ] Todos tienen bordes/muros cerrados.
- [ ] La pista es visible completa en 768×448.
- [ ] Cada tema usa su tileset y su paleta.
- [ ] La validación de contenido pasa.

**Depende de:** S1.3, S1.5, S2.1.
**Esfuerzo:** L.

### ✅ S2.3 — Checkpoints como puertas y anti-corte

**Objetivo:** que una vuelta solo cuente si se pasa por las puertas y en el
sentido correcto.

**Cambios:**
- `src/config/schema/track.ts`: `angle` y `width` en todos los waypoints;
  medallas.
- `src/race/LapTracker.ts`: cruce de segmento, dirección, orden, wrong-way.
- `src/race/NextTargetIndicator.ts`: dibujar la puerta y una flecha de
  dirección, no solo un círculo.
- `src/race/RaceHud.ts`: aviso de “dirección contraria” y “vuelta invalidada”.
- Tests: `tests/lapTracker.test.ts`.

**Detalle:**
- Posición anterior + actual; distancia firmada al plano de la puerta.
- Cruce válido si:
  - cambia de signo respecto al plano;
  - el desplazamiento lateral está dentro de `width/2`;
  - el vector de velocidad va en la dirección de la puerta.
- Sin `width`, fallback al radio actual para compatibilidad.
- Si se pasa fuera de la puerta, la vuelta se invalida o no cuenta.
- Detección de sentido contrario con el vector de la siguiente puerta.

**Criterios de aceptación:**
- [ ] Cruzar la meta sin pasar gates no cuenta.
- [ ] Pasar un gate en sentido contrario no cuenta.
- [ ] Pasar fuera de la anchura del gate no cuenta.
- [ ] A alta velocidad no se salta la detección.
- [ ] El HUD avisa de dirección contraria.
- [ ] Snake no se puede cortar por el campo.

**Depende de:** S2.2.
**Esfuerzo:** L.

### ✅ S2.4 — Pantalla de resultados y pausa

**Objetivo:** cerrar el bucle de juego con información y acciones claras.

**Cambios:**
- `src/race/RaceResults.ts`: overlay o escena de resultados.
- `src/race/PauseMenu.ts`: pausa, reanudar, reiniciar, salir.
- `src/race/RaceHud.ts`: estado final.
- `src/scenes/RaceScene.ts`: integrar pausa y fin de carrera.
- `src/race/BestLaps.ts`: récord por preset.
- `public/tracks/*.json`: tiempos de medalla.
- Tests de formato y thresholds.

**Detalle:**
- Resultados: tiempo total, lista de vueltas, mejor vuelta, delta con récord,
  medalla, botones “Reintentar”, “Siguiente”, “Menú”.
- Pausa: P/Esc, botón en HUD, auto-pausa al perder foco.
- Medallas: oro/plata/bronce desde datos del circuito.
- Récord: separado por circuito + coche + preset.
- Si el tuning es custom, se guarda con hash o se marca “no oficial”.

**Criterios de aceptación:**
- [ ] Al terminar se ve el tiempo total y todas las vueltas.
- [ ] Se puede reintentar, pasar al siguiente circuito o volver al menú.
- [ ] La pausa congela física, audio y cronómetro.
- [ ] El récord de un preset no se mezcla con otro.
- [ ] La medalla se calcula con los datos del circuito.

**Depende de:** S2.3.
**Esfuerzo:** M.

### ✅ S2.5 — Reinicio rápido y reset a la última puerta

**Objetivo:** que quedarse atascado no obligue a abandonar la carrera.

**Cambios:**
- `src/scenes/RaceScene.ts`: tecla R y acción de menú.
- `src/race/LapTracker.ts`: recordar última puerta pasada y su orientación.
- `src/race/RaceHud.ts`: aviso de “Reset +3 s”.

**Detalle:**
- R recoloca el coche en la última puerta pasada, con velocidad 0 y la
  orientación de la puerta.
- Penalización de 3 s para que no sea una forma de hacer trampa.
- Si no se ha pasado ninguna puerta, se recoloca en la salida.
- El reinicio de carrera (desde pausa o fin) vuelve a la cuenta atrás.

**Criterios de aceptación:**
- [ ] R funciona en cualquier momento.
- [ ] El coche aparece mirando en la dirección correcta.
- [ ] La penalización se suma al tiempo.
- [ ] No se puede usar para saltarse una puerta.

**Depende de:** S2.3, S2.4.
**Esfuerzo:** S.

### S2.6 — Fantasma, medallas y rejugabilidad

**Objetivo:** dar una razón para repetir cada circuito.

**Cambios:**
- `src/race/GhostRecorder.ts` y `GhostPlayer.ts`.
- `src/race/GhostStore.ts` (localStorage versionado).
- `src/race/RaceHud.ts`: indicador de fantasma.
- `src/scenes/TitleScene.ts`: mejores tiempos por circuito y medallas.
- `src/settings/Settings.ts`: toggle de fantasma.
- Tests: serialización, muestreo, interpolación.

**Detalle:**
- Grabar la mejor vuelta a 20 Hz: `[t, x, y, angle]`.
- Guardar solo la mejor vuelta por circuito+coche+preset.
- Reproducir un coche translúcido, sin colisión, con interpolación.
- Cap de duración 90 s; si se excede, no se guarda.
- Mostrar “fantasma” en el HUD y opción de ocultarlo.
- Medallas y récords visibles en el título.

**Criterios de aceptación:**
- [ ] El fantasma reproduce la mejor vuelta con suavidad.
- [ ] No interfiere con la física ni con el coche real.
- [ ] Se puede activar/desactivar.
- [ ] Los récords antiguos no rompen la carga.
- [ ] El título muestra los mejores tiempos.

**Depende de:** S2.4.
**Esfuerzo:** M.

---

## Sprint 3 — Identidad visual y UI (P2)

**Meta del sprint:** que el juego parezca un juego de rally pixel art de los 90,
no un prototipo de rectángulos.

**Criterio de salida:** coche legible, 3 temas visuales distintos, HUD y título
con identidad, controles móviles que no tapan la pista.

### S3.1 — Arte del coche

**Objetivo:** un coche reconocible y divertido, legible a simple vista.

**Cambios:**
- `public/cars/rally-hatch.png`: nuevo sprite de 64×32 (o 72×36),
  cenital/3⁄4, con ruedas, parabrisas, faros, número y sombra.
- `src/entities/Car.ts`: sombra, escala, origen, luces de freno y animación
  de ruedas si aplica.
- `public/cars/rally-hatch.json`: `length`/`width` nuevos y retuning de
  colisión.
- `docs/ART_DIRECTION.md`: paleta, tamaño, perspectiva y reglas de silueta.

**Criterios de aceptación:**
- [ ] Se reconoce la dirección del coche en menos de 0,5 s.
- [ ] Se distingue a 50% de escala.
- [ ] La huella de colisión coincide con el sprite.
- [ ] Hay sombra y feedback de freno/derrape.
- [ ] No hay pixel art borroso ni escalado no entero.

**Depende de:** S1.3, S1.4.
**Esfuerzo:** M.

### S3.2 — Tilesets, decoración y temas

**Objetivo:** que cada circuito tenga un escenario propio y legible.

**Cambios:**
- `public/tiles/forest.png`, `desert.png`, `canyon.png` (atlas 32 px).
- Tiles: asfalto, borde, bordillo, tierra, arena, hierba, roca, árbol, valla,
  muro, arco de meta, gate.
- `src/track/TrackRenderer.ts`: dos o tres capas decorativas; `theme`
  selecciona tileset/fondo.
- `src/scenes/BootScene.ts`: cargar todos los tilesets.
- `public/tracks/*.json`: usar los tilesets nuevos.
- `docs/ASSETS_CREDITS.md`: créditos y licencias.

**Criterios de aceptación:**
- [ ] Bosque, desierto y serpiente se distinguen por color y props.
- [ ] No hay grandes superficies planas sin detalle.
- [ ] Los bordes de pista se leen.
- [ ] Los props no tapan la conducción.
- [ ] 60 fps con todas las capas.

**Depende de:** S2.2.
**Esfuerzo:** L.

### S3.3 — UI 90s coherente

**Objetivo:** unificar HUD, título, resultados y menús con una identidad
pixel art.

**Cambios:**
- `public/fonts/` fuente bitmap/pixel con licencia.
- `src/ui/theme.ts`: paleta, fuentes, paneles, iconos, escala.
- `src/ui/strings.ts`: textos centralizados.
- `src/race/RaceHud.ts`, `RaceResults.ts`, `PauseMenu.ts`: paneles nuevos.
- `src/scenes/TitleScene.ts`: logo, fondo animado, carrusel de circuitos con
  preview, mejores tiempos y botón de inicio.
- `src/settings/SettingsMenu.ts`: reestilizar con la misma paleta/tipografía.
- Sustituir emoji por iconos pixel.

**Criterios de aceptación:**
- [ ] No queda ningún emoji en la UI de juego.
- [ ] Título, HUD, resultados y pausa comparten paleta y tipografía.
- [ ] El título se siente como una portada de juego, no un menú de debug.
- [ ] La UI se lee en móvil y escritorio.
- [ ] Los textos están centralizados y en español consistente.

**Depende de:** S1.7, S3.1.
**Esfuerzo:** L.

### S3.4 — HUD responsive y legibilidad móvil

**Objetivo:** que la información se lea en 844×390 sin tapar la acción.

**Cambios:**
- `src/ui/theme.ts`: `UiScale` calculado desde `scene.scale`.
- `src/race/RaceHud.ts`: layout responsive.
- `src/race/NextTargetIndicator.ts`: flecha hacia la siguiente puerta.
- `src/scenes/RaceScene.ts`: gestionar resize/orientación.

**Detalle:**
- HUD superior izquierdo: vuelta, tiempo, mejor.
- HUD superior derecho: velocidad, marcha, RPM.
- Zona inferior reservada a controles táctiles.
- En pantallas pequeñas, aumentar tamaño de fuente y reducir adornos.
- No usar posiciones absolutas en píxeles del canvas sin escalar.

**Criterios de aceptación:**
- [ ] En 844×390 se lee todo sin hacer zoom.
- [ ] Los controles no tapan el HUD ni el coche.
- [ ] Al girar el dispositivo no se rompe el layout.
- [ ] La UI escala con el canvas y no con la ventana.

**Depende de:** S1.7, S3.3.
**Esfuerzo:** M.

### S3.5 — Controles táctiles rediseñados

**Objetivo:** jugar cómodo con dos pulgares sin tapar la pista.

**Cambios:**
- `src/input/TouchControls.ts`: nuevo layout y estilos.
- `index.html`: CSS de controles, safe areas y estados.
- `src/settings/Settings.ts`: modo de controles (`auto`, `show`, `hide`).
- `src/scenes/RaceScene.ts`: pausa y ocultación automática.

**Detalle:**
- Zona inferior izquierda: volante (◀ ▶ o pad).
- Zona inferior derecha: acelerar/frenar.
- Freno de mano: botón pequeño encima del acelerador, fuera del centro.
- Pausa: botón superior derecho.
- Botones de 56–72 px, opacidad configurable, `pointer-events: auto`.
- Safe areas: `env(safe-area-inset-left/right/bottom)`.
- En escritorio, ocultar por defecto si se usa teclado.
- Evitar el centro de la pista; nunca tapar el coche.

**Criterios de aceptación:**
- [ ] Se puede jugar con dos pulgares sin soltar.
- [ ] El freno de mano no está sobre la trazada.
- [ ] No hay botones atascados al salir de la ventana.
- [ ] En iOS Safari y Android Chrome funciona.
- [ ] Se pueden ocultar/mostrar desde ajustes.

**Depende de:** S1.6.
**Esfuerzo:** M.

### S3.6 — Ajustes para jugadores: presets y reset

**Objetivo:** que el menú de ajustes sea comprensible y no un panel de tuning.

**Cambios:**
- `src/settings/carTuning.ts`: presets `Arcade`, `Rally`, `Simulación` y
  `Personalizado`.
- `src/settings/Settings.ts`: preset, volúmenes, ghost, reduced motion,
  contraste, bindings.
- `src/settings/SettingsMenu.ts`: presets, sliders avanzados, reset.
- `src/race/BestLaps.ts`: clave por preset/hash.

**Detalle:**
- Preset por defecto: `Arcade`.
- “Rally”: más derrape y respuesta, pensado para divertirse.
- “Simulación”: más agarre y peso, sin llegar a sim realista.
- Sliders avanzados solo visibles al elegir “Personalizado”.
- “Restaurar valores” por sección.
- Textos claros, sin “menos = más derrape”.

**Criterios de aceptación:**
- [ ] Un jugador nuevo puede elegir un preset y jugar.
- [ ] Los presets cambian el feel de forma perceptible.
- [ ] Restaurar valores funciona.
- [ ] Los récords se separan por preset.
- [ ] Los ajustes persisten y migran sin romper.

**Depende de:** S1.4, S3.3.
**Esfuerzo:** M.

---

## Sprint 4 — Audio, tutorial y accesibilidad (P3)

**Meta del sprint:** que el juego suene, se explique y sea accesible.

**Criterio de salida:** motor con marchas, derrape expresivo, tutorial básico,
volúmenes, bindings y opciones de accesibilidad.

### S4.1 — Audio de conducción y ambiente

**Objetivo:** que el oído también comunique velocidad, carga y superficie.

**Cambios:**
- `src/audio/EngineAudio.ts`: motor con RPM, marcha y carga.
- `src/audio/SkidAudio.ts`: derrape con pitch/volumen por slip.
- `src/audio/SurfaceAudio.ts`: rumble fuera de pista.
- `src/audio/ImpactAudio.ts`: impactos y frenadas.
- `src/race/RaceAudio.ts`: orquestar todo.
- `public/audio/`: loops de motor, derrape, ambiente, música.
- `docs/ASSETS_CREDITS.md`.
- `src/settings/Settings.ts`: volúmenes master/música/SFX.

**Detalle:**
- Loop de motor de 1–2 s, no 0,07 s.
- Capas o crossfade por RPM; cambio de marcha audible.
- Derrape: pitch y volumen según `slipRatio`.
- Fuera de pista: rumble loop distinto por superficie.
- Impacto: one-shot con volumen por velocidad normal.
- Música: 1–2 loops chiptune (menú/carrera).
- Fade in/out al pausar y terminar.

**Criterios de aceptación:**
- [ ] El motor suena a motor, no a zumbido.
- [ ] Se oye el cambio de marcha y la carga.
- [ ] El derrape cambia con el ángulo.
- [ ] Fuera de pista se oye distinto.
- [ ] Volúmenes separados y persistentes.
- [ ] No hay clics ni loops cortados.

**Depende de:** S1.4, S1.5.
**Esfuerzo:** L.

### S4.2 — Tutorial y onboarding

**Objetivo:** que un jugador nuevo sepa qué hacer sin leer documentación.

**Cambios:**
- `src/race/TutorialOverlay.ts` o escena de ayuda.
- `src/scenes/TitleScene.ts`: “Cómo jugar”.
- `src/ui/strings.ts`: textos de ayuda.
- `src/settings/Settings.ts`: “mostrar ayudas”.

**Detalle:**
- Primer arranque: explicar acelerar, frenar, girar y freno de mano.
- En carrera: recordatorio de “sigue la puerta verde” durante la primera
  vuelta.
- Explicar que el freno de mano sirve para derrapar.
- Se puede omitir y no vuelve a salir si se desactiva.
- Incluir una vuelta de práctica opcional sin cronómetro.

**Criterios de aceptación:**
- [ ] Un jugador nuevo puede completar una vuelta sin leer el README.
- [ ] El tutorial se puede omitir.
- [ ] No molesta en carreras posteriores.
- [ ] Funciona con teclado, mando y táctil.

**Depende de:** S1.6, S2.3, S3.3.
**Esfuerzo:** S.

### S4.3 — Accesibilidad

**Objetivo:** que el juego sea usable por más gente y en más contextos.

**Cambios:**
- `src/input/InputManager.ts`: bindings configurables.
- `src/settings/SettingsMenu.ts`: remapeo de teclas, escala de UI, contraste,
  reducción de movimiento.
- `src/ui/theme.ts`: paleta de alto contraste/colorblind.
- `src/race/RaceHud.ts`: subtítulos/indicadores de audio.
- `src/scenes/RaceScene.ts`: respetar `prefers-reduced-motion`.

**Detalle:**
- Remapeo de acelerar, frenar, izquierda, derecha, freno de mano, pausa y
  reset.
- Escala de UI: 100%, 125%, 150%.
- Reducción de movimiento: sin camera shake, menos partículas, sin líneas de
  velocidad.
- Alto contraste: bordes de pista y gates más visibles.
- Subtítulos: “Derrape”, “Impacto”, “Checkpoint”, “Meta”.
- Menús navegables con teclado y foco visible.

**Criterios de aceptación:**
- [ ] Se puede jugar solo con teclado y remapear teclas.
- [ ] La opción de reducción de movimiento funciona.
- [ ] El modo alto contraste mejora la lectura de pista/gates.
- [ ] Los menús tienen foco visible y `aria-label` en DOM.
- [ ] No hay dependencia exclusiva del color para información crítica.

**Depende de:** S3.3, S3.4, S3.5.
**Esfuerzo:** M.

### S4.4 — Localización consistente

**Objetivo:** eliminar la mezcla de idiomas y dejar la base para traducir.

**Cambios:**
- `src/ui/strings.ts`: catálogo de textos en español.
- `src/ui/theme.ts`: fuente y estilos por idioma.
- `public/tracks/*.json`: renombrar “Snake” → “Serpiente” (o decisión
  definitiva).
- `README.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`: reflejar nombres.

**Criterios de aceptación:**
- [ ] No quedan textos hardcodeados en escenas/UI.
- [ ] Todos los textos visibles están en español consistente.
- [ ] Los nombres de circuitos son coherentes.
- [ ] La estructura permite añadir inglés sin tocar la lógica.

**Depende de:** S3.3.
**Esfuerzo:** S.

---

## Sprint 5 — Hardening, rendimiento y release (P3)

**Meta del sprint:** dejar el juego estable, validado y publicable.

### S5.1 — Validación de contenido y limpieza técnica

**Objetivo:** que un circuito mal authored falle en CI, no en producción.

**Cambios:**
- `scripts/validate-content.mjs` o `tests/trackContent.test.ts`.
- Validaciones:
  - todos los circuitos parsean;
  - todas las superficies tienen `grip`/`drag`;
  - spawn sobre superficie válida y sin muro;
  - gates dentro de la pista y con anchura suficiente;
  - muros cierran el recorrido;
  - longitud de vuelta dentro de rango;
  - medallas definidas y ordenadas;
  - no hay circuitos duplicados.
- Eliminar `theme`/`wheelbaseOffset` muertos o implementarlos.
- Limpiar warnings de lint en scripts.
- `package.json`: `npm run validate`.

**Criterios de aceptación:**
- [ ] `npm run validate` pasa con los 3 circuitos.
- [ ] Un JSON inválido o una superficie sin definir rompe CI.
- [ ] No quedan campos de esquema sin uso.
- [ ] `lint` sin warnings nuevos.

**Depende de:** S2.2, S2.3.
**Esfuerzo:** M.

### S5.2 — Rendimiento y decisión Canvas/WebGL

**Objetivo:** 60 fps estables en móvil y una decisión de renderer informada.

**Cambios:**
- Benchmark de las 3 pistas con Canvas y WebGL.
- Reproducir/descartar el bug de Chrome Android que motivó `Phaser.CANVAS`.
- `src/main.ts`: `Phaser.AUTO` o Canvas según resultado, con fallback.
- `roundPixels: true`, atlases, object pools, cap de partículas.
- FPS overlay en ajustes de debug.

**Criterios de aceptación:**
- [ ] 60 fps en un móvil de gama media (o 30 fps estables como mínimo).
- [ ] Sin canvas en blanco en Chrome Android/Safari.
- [ ] Sin allocations por frame en el bucle de física/render.
- [ ] La decisión de renderer está documentada.

**Depende de:** S3.2, S4.1.
**Esfuerzo:** M.

### S5.3 — E2E y CI

**Objetivo:** que los flujos críticos se prueben en un navegador real.

**Cambios:**
- Playwright (o CDP) smoke tests:
  - carga el título;
  - inicia carrera;
  - acelera/gira y el velocímetro cambia;
  - pausa/reanuda;
  - termina una carrera con debug shortcut;
  - viewport móvil 844×390.
- `.github/workflows/ci.yml`: `lint`, `test`, `validate`, `build`,
  `test:e2e`.
- `.github/workflows/deploy.yml`: mismas comprobaciones antes de publicar.

**Criterios de aceptación:**
- [ ] CI verde en cada PR.
- [ ] El smoke test detecta un canvas en blanco.
- [ ] El test móvil detecta controles fuera de pantalla.
- [ ] El deploy solo publica si todo pasa.

**Depende de:** S3.5, S4.2.
**Esfuerzo:** M.

### S5.4 — Documentación y release

**Objetivo:** que el estado del proyecto quede reflejado.

**Cambios:**
- `docs/ROADMAP.md`: fases y estado.
- `docs/CHANGELOG.md`: entradas cortas por versión.
- `docs/ANALISIS.md`: decisiones nuevas (paso fijo, colisión, gates).
- `README.md`: controles, modos, stack, créditos.
- `docs/ASSETS_CREDITS.md`: assets y licencias.
- Issues/milestones por sprint.

**Criterios de aceptación:**
- [ ] README permite jugar sin leer código.
- [ ] Roadmap y changelog reflejan la realidad.
- [ ] Créditos de arte/audio/fuentes completos.
- [ ] Issues creadas y asignadas a milestones.

**Depende de:** todas.
**Esfuerzo:** S.

### S5.5 — QA manual y release candidate

**Objetivo:** validar la experiencia real antes de publicar.

**Matriz:**
- Android Chrome gama media.
- iPhone Safari.
- Desktop Chrome/Firefox.
- Teclado, gamepad y táctil.
- Horizontal/vertical (vertical muestra rotate hint).
- Audio activado/desactivado, pausa, fullscreen.
- 3 circuitos, 3 presets, fantasma on/off.

**Criterios de aceptación:**
- [ ] No hay bugs bloqueantes.
- [ ] El juego se completa en los 3 circuitos.
- [ ] No hay errores en consola.
- [ ] La experiencia móvil es cómoda.
- [ ] Se puede publicar en GitHub Pages/itch.io.

**Depende de:** S5.1–S5.4.
**Esfuerzo:** M.

---

## 5. Orden recomendado de ejecución

| Orden | Tareas | Resultado |
|---:|---|---|
| 1 | S1.1, S1.2 | Baseline y bucle estable |
| 2 | S1.3 | Muros sólidos, sin túneles |
| 3 | S1.4, S1.5 | Feel con peso y superficies reales |
| 4 | S1.6, S1.7 | Input cómodo y HUD útil |
| 5 | S1.8 | Tests de aceptación y contenido |
| 6 | S2.1, S2.2 | 3 circuitos nuevos |
| 7 | S2.3 | Gates y anti-corte |
| 8 | S2.4, S2.5 | Resultados, pausa y reset |
| 9 | S2.6 | Fantasma, medallas y récords |
| 10 | S3.1, S3.2 | Coche y escenarios |
| 11 | S3.3–S3.6 | UI, móvil y ajustes |
| 12 | S4.1–S4.4 | Audio, tutorial, accesibilidad, idioma |
| 13 | S5.1–S5.5 | Validación, rendimiento, CI y release |

### Primer PR recomendado

**PR 1: S1.2 + S1.3** — paso fijo y colisión sólida, con tests, sin cambiar
todavía el tuning. Es el cambio de mayor impacto y el que desbloquea todo lo
demás. Se puede probar con el tuning actual: el coche seguirá siendo raro, pero
los muros dejarán de atravesarse.

**PR 2: S1.1 + S1.4 + S1.8 (parcial)** — simulador de métricas, re-tuning y
tests de feel.

**PR 3: S1.5 + S1.6 + S1.7** — superficies, input y HUD.

---

## 6. Cambios de esquema y datos

### 6.1 Coche (`src/config/schema/car.ts`)

Añadir campos con defaults o bump de `schemaVersion` a 2 y migrar:

| Campo | Uso |
|---|---|
| `rollingResistance` | Pérdida de velocidad al rodar |
| `aeroDrag` | Arrastre dependiente de velocidad |
| `engineBraking` | Retención al soltar gas |
| `steerResponse` | Velocidad de respuesta del volante |
| `understeer` | Pérdida de giro a alta velocidad |
| `driftGripLoss` | Pérdida de agarre lateral al girar |
| `handbrakeGripLoss` | Derrape extra con freno de mano |
| `flickImpulse` | Impulso máximo del contravolante |
| `reverseDelay` | Tiempo antes de entrar en marcha atrás |

Recomendación: bump a `schemaVersion: 2`, aceptar v1 con defaults y migrar
`rally-hatch.json`. Así el contrato queda claro y no se acumulan campos
opcionales sin dueño.

### 6.2 Circuito (`src/config/schema/track.ts`)

- `WaypointSchema`: `angle` y `width` para todos los tipos (gates).
- `medals`: `{ goldMs, silverMs, bronzeMs }`.
- `theme`: valores cerrados (`forest`, `desert`, `canyon`) o string libre con
  validación en contenido.
- `TiledMapAdapter`: leer `goldTime`, `silverTime`, `bronzeTime` de map
  properties.
- `TrackRenderer`: capas `decor` opcionales; no afectan a `TrackDefinition`
  físico.

### 6.3 Ajustes (`src/settings/Settings.ts`)

Añadir:

- `tuningPreset: 'arcade' | 'rally' | 'sim' | 'custom'`.
- `masterVolume`, `musicVolume`, `sfxVolume`.
- `ghostEnabled`, `showHints`, `reducedMotion`, `highContrast`.
- `touchControlsMode: 'auto' | 'show' | 'hide'`.
- `keyBindings`.
- `uiScale`.
- `settingsVersion` para migraciones.

### 6.4 Persistencia

- `BestLaps`: clave `trackKey::carKey::presetOrHash`.
- `GhostStore`: clave `trackKey::carKey::presetOrHash`, versión de formato.
- `Settings`: migración desde la clave actual `rally90s:settings`.
- Récords antiguos: conservar como “legacy” o descartar con aviso; no romper la
  carga.

---

## 7. Pipeline de arte, audio y fuentes

### 7.1 Arte

- Resolución interna: mantener 768×448 de momento.
- Tile: 32×32.
- Coche: 64×32 (o 72×36) con sombra.
- Paleta: 24–32 colores por tema.
- Perspectiva: cenital con un punto de 3⁄4 para legibilidad.
- Herramientas: Aseprite/Libresprite; export PNG con transparencia.
- Atlas por tema; nombres estables y documentados.
- Créditos y licencia en `docs/ASSETS_CREDITS.md`.

### 7.2 Audio

- Motor: loop de 1–2 s, capas por RPM.
- Derrape: loop corto con pitch.
- Ambiente: loop por tema.
- Música: 1–2 loops chiptune.
- Fuentes: CC0/OFL; documentar.
- Evitar clips de menos de 100 ms para loops.

### 7.3 Fuentes y UI

- Fuente bitmap/pixel con licencia.
- `BitmapText` para HUD, títulos y menús de juego.
- Paneles 9-slice o dibujados por código.
- Iconos pixel 8×8/16×16, sin emoji.
- Escala de UI centralizada.

### 7.4 Tiled

- Capas estándar: `surface`, `walls`, `decor`, `waypoints`.
- Objetos: `spawn`, `start_finish`, `checkpoint`.
- Propiedades: `angle`, `width`, `theme`, `laps`, `goldTime`,
  `silverTime`, `bronzeTime`.
- El layer `walls` no se renderiza; es colisión.
- Documento de convenciones en `docs/TILED.md`.

---

## 8. QA y verificación

### 8.1 Tests automáticos

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Física | Vitest | Aceleración, freno, giro, derrape, superficies |
| Colisión | Vitest | Muros, esquinas, alta velocidad, deslizamiento |
| Paso fijo | Vitest | Framerate, clamp, pausa |
| Gates | Vitest | Cruce, anchura, dirección, anti-corte |
| Contenido | Vitest/script | Superficies, spawn, gates, muros, medallas |
| Persistencia | Vitest | Ajustes, récords, fantasmas, migraciones |
| E2E | Playwright/CDP | Título, carrera, HUD, pausa, móvil |
| Build | CI | Lint, test, validate, build |

### 8.2 Pruebas manuales

- 3 circuitos × 3 presets.
- Teclado, gamepad, táctil.
- 844×390, 390×844, 1280×720, 1920×1080.
- Audio on/off, volúmenes, pausa, fullscreen.
- Framerate en móvil de gama media.
- Reinicio, reset, fin de carrera, fantasma.
- Accesibilidad: teclado solo, alto contraste, reducción de movimiento.

### 8.3 Criterios de “listo para probar”

- [ ] `npm run lint` sin errores.
- [ ] `npm run test` verde.
- [ ] `npm run validate` verde.
- [ ] `npm run build` verde.
- [ ] Sin errores en consola.
- [ ] Probado en móvil real.
- [ ] CHANGELOG actualizado.

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El re-tuning sigue sin sentirse bien | Alto | Simulador + pruebas jugadas cortas; iterar en rama; no congelar hasta cumplir métricas |
| Los muros sólidos rompen el feel actual | Medio | Resolver deslizamiento, no rebote duro; probar con el tuning viejo primero |
| Rediseñar 3 circuitos lleva más de lo previsto | Alto | Empezar por S2.1 con esquemas; usar Tiled; validar longitud con script |
| Arte/audio con licencias dudosas | Medio | Usar CC0/OFL/Kenney/OpenGameArt; créditos desde el primer asset |
| WebGL vuelve a fallar en Chrome Android | Medio | Mantener Canvas como fallback; benchmark y documentar |
| El HUD móvil tapa la pista | Alto | Probar en 844×390 desde el primer día; layout fuera del playfield |
| Cambios de esquema rompen récords/ajustes | Medio | Claves versionadas y migración; descartar récords legacy con aviso |
| El fantasma ocupa demasiado en localStorage | Bajo | 20 Hz, arrays compactos, cap 90 s |
| Scope creep (multijugador, editor, IA) | Alto | Issues separadas; no entrar en esta iteración |
| El jugador nuevo no entiende el derrape | Medio | Tutorial S4.2 y textos claros desde S3.6 |

---

## 10. Definition of Done global

Un sprint se considera terminado cuando:

- [ ] El código compila y pasa `lint`.
- [ ] Los tests nuevos y existentes pasan.
- [ ] La validación de contenido pasa.
- [ ] Se ha probado en escritorio y en móvil (si toca UI/feel).
- [ ] Se han cumplido los criterios de aceptación de las tareas.
- [ ] No hay errores en consola.
- [ ] El CHANGELOG tiene una entrada breve.
- [ ] Las decisiones importantes están en `docs/ANALISIS.md` o en el plan.
- [ ] No se ha roto ningún flujo anterior (título → carrera → resultados).

---

## 11. Trazabilidad auditoría → plan

| Auditoría | Tema | Tareas del plan |
|---|---|---|
| AU-1 | Colisiones reales | S1.3, S1.8 |
| AU-2 | Paso de física fijo | S1.2 |
| AU-3 | Re-tuning de conducción | S1.1, S1.4, S1.8 |
| AU-4 | Superficies reales | S1.5, S1.8 |
| AU-5 | Input con rampa | S1.6 |
| AU-6 | HUD de conducción | S1.7, S3.4 |
| AU-7 | Tests de aceptación | S1.8, S5.1, S5.3 |
| AU-8 | Rediseñar circuitos | S2.1, S2.2 |
| AU-9 | Checkpoints como puertas | S2.3 |
| AU-10 | Estructura de carrera | S2.4, S2.5 |
| AU-11 | Rejugabilidad | S2.6 |
| AU-12 | Coche nuevo | S3.1 |
| AU-13 | Tileset y decoración | S3.2 |
| AU-14 | UI 90s | S3.3 |
| AU-15 | HUD responsive | S3.4 |
| AU-16 | Controles móviles | S3.5 |
| AU-17 | Ajustes para jugadores | S3.6 |
| AU-18 | Audio | S4.1 |
| AU-19 | Tutorial | S4.2 |
| AU-20 | Accesibilidad | S4.3 |
| AU-21 | Localización | S4.4 |
| AU-22 | Limpieza técnica | S5.1, S5.2, S5.3 |

---

## 12. Decisiones abiertas

Estas decisiones se resuelven durante la fase indicada, no antes:

1. **Renderer:** Canvas vs WebGL (S5.2), tras benchmark y reproducción del bug.
2. **Volante táctil:** botones con rampa vs joystick analógico (S3.5). Default:
   botones con rampa; joystick si la prueba en móvil lo pide.
3. **Cámara:** mantener fija (F3) vs modo cercano opcional (S3.4). Default:
   fija; el modo cercano no entra en esta iteración.
4. **Formato de fantasma:** arrays compactos vs JSON con objetos (S2.6).
   Default: arrays compactos.
5. **Idioma:** español solo vs español/inglés (S4.4). Default: español, con
   catálogo preparado para traducir.
6. **Persistencia de récords:** por preset vs hash de tuning custom (S3.6).
   Default: preset + hash para custom.
7. **Tamaño del coche:** 64×32 vs 72×36 (S3.1). Default: 64×32 para no
   disparar el trabajo de arte.

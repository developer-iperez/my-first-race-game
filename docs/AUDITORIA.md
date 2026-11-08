# Auditoría de Rally 90s — conducción, diseño y jugabilidad

> Fecha: 2026-11-08
> Estado: auditoría previa al rediseño. No se ha modificado código de juego.
> Alcance: `src/`, datos de `public/tracks` y `public/cars`, assets, tests y
> partida real en Chromium a 768×448 y 844×390 (móvil apaisado).

## Veredicto

La base técnica está bien: físicas puras, datos JSON validados, 70 tests que
pasan y build correcto. El problema no es la calidad del código, es que **el
juego todavía se siente como un prototipo de laboratorio**:

- El coche no tiene peso: acelera, frena y gira como un interruptor.
- Los circuitos son cajas vacías sin límites físicos reales.
- La presentación no comunica velocidad, peligro ni progreso.
- El bucle de juego dura menos que una partida de móvil y no da razones para
  repetir.

No son "un par de ajustes". Hay que rediseñar la conducción, los circuitos y la
capa visual/jugable.

## Metodología

- Revisión de todo `src/`, los JSON de coche y circuitos, assets y tests.
- Simulación de `carPhysics.ts` a 60 fps con el tuning real por defecto.
- Partida real en Chromium a 768×448 y a 844×390 (móvil apaisado).
- `npm test`: 70 tests OK. `npm run build`: OK.

---

## 1. Estilo de conducción

### Lo que pasa hoy

| Métrica | Valor actual | Sensación |
|---|---:|---|
| 0 → 100% de velocidad | **0,37 s** | El motor es un interruptor |
| Frenada 100% → 0 | **0,13 s / 16 px** | Medio coche de distancia |
| Soltar gas 1 s | **pierde 70%** | El coche frena solo |
| Radio de giro | **96 px a cualquier velocidad** | Gira en 2 largos de coche, siempre |
| Derrape a fondo + gas | **68% lateral (43°)** | El coche va casi de lado por defecto |
| Freno de mano 0,5 s | **100% lateral** | Derrape total, luego recuperación brusca |
| Muro central de 128 px | **atravesado en 0,88 s** | Los muros no son sólidos |
| Arena | **grip 1, drag 1** | Físicamente igual que el asfalto |

### Problemas concretos

1. **Aceleración instantánea.** Con el tuning por defecto, `enginePower` está
   sobredimensionado: el coche llega al tope de velocidad en menos de medio
   segundo. La única limitación real es el clamp de `maxSpeed`, no una curva de
   motor. No hay progresión de velocidad ni sensación de empuje.

2. **Frenada de teletransporte.** `brakingPower` y la fricción hacen que el
   coche pase de 312 px/s a 0 en 0,13 s y 16 px. No hay distancia de frenada,
   ni transferencia de peso, ni riesgo al frenar tarde. Además, si mantienes
   pulsado abajo, entra directamente en marcha atrás.

3. **Soltar el gas es casi frenar.** `gripForward = 0.98` por frame a 60 fps
   significa perder ~70% de la velocidad en un segundo. El coche no rueda: se
   apaga.

4. **El giro no tiene término medio.** El radio es prácticamente constante a
   cualquier velocidad porque el objetivo de giro escala con la velocidad. A
   velocidad alta no hay subviraje progresivo: o vas sobre raíles o, al pasar de
   cierto ángulo, el agarre lateral cae a 0,05 y el coche se va de lado. Es el
   clásico "o agarra o es hielo".

5. **El derrape por defecto es demasiado extremo.** A full lock + gas el
   equilibrio es 68% lateral. Eso no es un derrape deportivo: es conducir de
   lado permanentemente. El freno de mano llega al 100% lateral, y al soltarlo
   el agarre vuelve de golpe.

6. **El flick mete un latigazo artificial.** El modelo añade hasta
   `1.6 × velocidad total` de velocidad lateral en un frame. Luego el límite de
   velocidad escala el vector entero. Puede sentirse como si el juego te
   empujara o te frenara de golpe, no como transferencia de peso.

7. **Los muros no existen como colisión.** `isWallAt()` solo aplica una
   retención de velocidad del 0,9 por frame. Con gas, el coche atraviesa la isla
   central de 128 px en 0,88 s; sin gas, se queda atascado dentro. En la prueba
   real el coche acabó encima del bloque marrón central. Esto es un bug de
   jugabilidad, no solo de feel.

8. **Colisión y superficies se muestrean solo en el centro del coche.** El coche
   puede tener medio chasis fuera de pista sin que pase nada. No hay huella del
   vehículo ni resolución de colisión: no hay deslizamiento contra pared, rebote
   ni corrección de posición.

9. **La arena no existe físicamente.** En `rally-02.json` el tile de arena no
   define `grip` ni `drag`; `TiledMapAdapter` lo ignora y `TrackQuery` devuelve
   1/1. La "Duna Veloz" tiene una zona de arena que se conduce exactamente igual
   que el asfalto.

10. **No hay feedback de conducción.** No hay velocímetro, cuentarrevoluciones,
    marchas, inclinación de carrocería, marcas de neumático, polvo por
    superficie, sonido de motor con carga ni cambio de pitch del derrape. El
    coche se tiñe de gris oscuro cuando derrapa, lo que lo ensucia visualmente
    pero no comunica nada.

11. **El input es digital y sin rampa.** Teclado y táctil dan volante 0 o 1. No
    hay suavizado, zona muerta, gamepad ni WASD. En un coche con este nivel de
    respuesta, eso hace que mantener una trazada sea a base de toques.

12. **No hay paso de física fijo.** Se usa el `deltaMs` del frame directamente.
    Un tirón de framerate o volver de una pestaña en segundo plano puede dar un
    paso enorme y atravesar muros o deformar la trayectoria.

### Objetivo de feel propuesto

| Métrica | Objetivo |
|---|---:|
| 0 → 90% velocidad | 2,5–4 s |
| Frenada 100% → 0 | 0,6–1,0 s / 120–200 px |
| Soltar gas 1 s | conservar 70–80% |
| Radio de giro lento | 60–80 px |
| Radio de giro rápido | 140–200 px, con subviraje progresivo |
| Derrape a fondo + gas | 25–40% lateral |
| Freno de mano | 45–60% lateral, recuperable en ~0,3–0,5 s |
| Muros | sólidos, con deslizamiento/rebote y sonido |
| Vuelta | 25–45 s |
| Carrera | 2–3 min |

---

## 2. Diseño visual y de interfaz

### Lo que se ve hoy

La captura real del circuito 1 es un **rectángulo gris enorme con un bloque
marrón en el centro**. No hay bosque, no hay bordes de pista, no hay curvas
dibujadas, no hay vegetación, no hay vallas, no hay boxes, no hay nada. "Bosque
Bravo" no tiene bosque. "Duna Veloz" es el mismo rectángulo con otro color en el
centro. "Snake" es una serpiente gris escalonada sobre verde.

Problemas:

1. **Solo hay 4 tiles** (asfalto, hierba, arena, muro) y son texturas planas.
   Faltan bordillos, líneas, arcenes, tierra, rocas, árboles, señales,
   neumáticos, vallas, gradas, meta con arco, etc.
2. **El campo `theme` no se usa.** Todos los circuitos comparten el mismo
   tileset. El diseño por datos promete temas, pero visualmente no existen.
3. **El coche es una cápsula azul borrosa de 48×24 px.** No se leen ruedas,
   parabrisas, faros ni dirección. A simple vista cuesta saber hacia dónde
   apunta.
4. **El HUD es minúsculo y no da la información clave.** 10 px de fuente, sin
   velocímetro, sin RPM, sin marcha, sin delta de vuelta, sin posición. Los
   iconos son emoji (🏁⏱🏆), que rompen la estética pixel art.
5. **La pantalla de título parece un menú de debug.** Texto plano sobre hierba,
   coche flotando, una franja a cuadros y flechas de 12×20 px. En móvil esas
   flechas son casi imposibles de tocar. Además, **el teclado no puede cambiar
   de circuito**: cualquier tecla inicia la carrera. Y si tienes el foco en el
   botón de ajustes y pulsas Enter/Espacio, también arranca la carrera.
6. **Idioma mezclado:** "RALLY 90s", "Bosque Bravo", "Dune Veloz", "Snake",
   "PULSA PARA EMPEZAR", "VOLVER A EMPEZAR". No hay una voz consistente.
7. **Los controles táctiles tapan la pista.** El freno de mano está centrado
   abajo, justo donde suele pasar el coche. Los botones son círculos de 64 px
   siempre visibles, incluso en escritorio al 35% de opacidad. No hay safe-area
   lateral, no se pueden personalizar ni ocultar, y no hay botón de pausa.
8. **El menú de ajustes no es un menú de juego.** Es un panel DOM genérico con
   `system-ui`, y los sliders se llaman "Agarre (menos = más derrape)" o
   "Velocidad máxima" con porcentajes. Un jugador nuevo no sabe qué elegir. No
   hay presets (Arcade/Rally/Simulación), ni "restaurar valores", ni explicación.
9. **El canvas fijo de 768×448 se escala de forma no entera** en 844×390; el
   pixel art pierde nitidez y el HUD queda diminuto. La UI DOM se ancla a la
   pantalla mientras el juego va con letterboxing.
10. **No hay identidad 90s real:** falta paleta limitada, dithering, scanlines
    opcionales, tipografía pixel consistente, logo, animación de attract mode,
    música chiptune.

---

## 3. Jugabilidad y contenido

1. **Solo hay 3 circuitos y dos son el mismo.** `rally-01` y `rally-02`
   comparten exactamente los mismos waypoints y el mismo layout de anillo, con
   distinto relleno central. No hay progresión ni variedad.
2. **Las vueltas duran ~5 s teóricos.** La ruta por waypoints mide 1.537 px; a
   velocidad máxima son 4,9 s/vuelta y 14,8 s para 3 vueltas. En la práctica,
   20–30 s de carrera. No da tiempo ni a entrar en calor.
3. **Los checkpoints son círculos de 80 px, no puertas.** No hay arcos, no hay
   anchura de gate, no hay dirección visual. Puedes cortar esquinas y, en Snake,
   atravesar el campo para tocar los puntos en orden. El `LapTracker` solo
   comprueba distancia y un semiplano de dirección, no que hayas pasado por la
   puerta.
4. **No hay penalización por cortar.** En Snake no hay muros en absoluto. En el
   circuito 1 el muro central se atraviesa con gas. En el 2 la arena no frena.
   La "pista" es una sugerencia.
5. **No hay oponentes, fantasma, copiloto ni modo rally.** Es un time trial de 3
   vueltas con mejor vuelta. No hay objetivos, medallas, tiempos de referencia,
   progresión ni desbloqueos.
6. **El resultado final es pobre.** Al terminar solo aparece "¡META!" con la
   mejor vuelta y un botón de reinicio. No hay tiempo total, lista de vueltas,
   delta con tu récord, siguiente circuito ni compartir.
7. **No hay pausa real.** El menú de ajustes hace de pausa, pero no hay botón de
   pausa, ni Escape, ni reinicio rápido en mitad de carrera, ni "volver a la
   parrilla". Si te quedas atascado, tienes que abrir ajustes y volver al menú.
8. **No hay tutorial ni pistas de control.** En carrera no se explica qué hace
   el freno de mano ni cuál es el objetivo. El jugador tiene que leer el README.
9. **El récord no es comparable.** Se guarda por circuito+coche, pero no por
   tuning. Puedes bajar la velocidad al 30% y batir tu mejor vuelta; el récord
   deja de significar nada.
10. **El audio está a medio hacer.** El bucle de motor dura 0,07 s: es un
    zumbido, no un motor. El pitch solo depende de la velocidad; no hay marchas,
    carga, decelación, impacto, fuera de pista ni música. El derrape es un loop
    fijo sin relación con el ángulo de deslizamiento.
11. **La experiencia móvil está comprometida.** Cámara fija que encoge el coche,
    HUD de 10 px, controles que tapan la pista y botones de flecha del título
    diminutos.
12. **El código promete datos que no se usan.** `theme` no se renderiza y
    `wheelbaseOffset` no se usa. O se implementan o se eliminan del esquema para
    no engañar.

---

## 4. Lo que sí merece la pena conservar

- `carPhysics.ts` es puro y testeable: buena base para iterar el feel sin Phaser.
- El diseño por datos (circuitos y coches JSON) y la validación con Zod.
- `LapTracker` bien separado y con tests.
- Persistencia de mejor vuelta y ajustes.
- El HUD de telemetría de depuración: es una herramienta muy útil para afinar.
- La migración a Tiled y el adaptador están bien encaminados.
- El overlay de errores y los controles táctiles multi-touch.

---

## 5. Lista de mejoras priorizada

### P0 — Hacer que conducir se sienta bien (urgente)

1. **Colisiones reales.**
   - Muros sólidos con huella del coche (no solo el centro).
   - Detección barrida para que no se atraviesen a velocidad.
   - Respuesta de deslizamiento/rebote, corrección de posición, polvo y sonido
     de impacto.
   - Reset automático si el coche queda atascado.
   - Añadir muros/bordes a los 3 circuitos; hoy Snake no tiene ninguno.

2. **Paso de física fijo.**
   - Acumulador a 60/120 Hz y clamp de delta máximo.
   - Pausa real al perder foco/visibilidad.
   - Subpasos para colisión y para el flick.

3. **Rehacer el tuning de conducción.**
   - Separar arrastre, resistencia a la rodadura, freno y motor.
   - Curva de potencia con caída a alta velocidad; 0→90% en 2,5–4 s.
   - Frenada de 0,6–1,0 s, con distancia real.
   - Volante con rampa de entrada (0,12–0,2 s) y radio de giro que crezca con la
     velocidad.
   - Subviraje progresivo en vez de "agarre 0,9 o hielo 0,05".
   - Derrape objetivo 25–40%; freno de mano 45–60%; recuperación suave.
   - Eliminar o limitar el latigazo del flick a ~0,25–0,35 de la velocidad, no
     1,6×.

4. **Superficies de verdad.**
   - Muestrear grip/drag en las 4 esquinas del coche.
   - Definir arena, tierra, hierba y asfalto con valores distintos.
   - Efectos por superficie: polvo, sonido, velocidad punta, derrape.
   - Validar que todas las superficies referenciadas tengan `grip` y `drag`.

5. **Input.**
   - Rampa de volante, zona muerta y soporte de gamepad.
   - WASD además de flechas.
   - Dirección táctil analógica o botones con rampa.
   - Poder ocultar/recolocar los controles táctiles.

6. **HUD de conducción.**
   - Velocímetro grande, marcha/RPM, indicador de derrape.
   - Delta de vuelta y mejor vuelta visible.
   - Feedback visual de velocidad: líneas de velocidad, polvo, marcas de
     neumático, pequeña sacudida de cámara.

7. **Tests de aceptación del feel.**
   - 0→90%, frenada, coasting, radio de giro, ángulo de derrape, tiempo de
     recuperación, cruce de muro.
   - Tests de contenido: spawn válido, checkpoints alcanzables, todos los tiles
     definidos, longitud de vuelta mínima.

### P1 — Convertirlo en un juego, no en un circuito de pruebas

8. **Rediseñar los 3 circuitos desde cero.**
   - Identidad real: bosque con árboles/rocas, dunas con arena y crestas,
     serpiente técnica con vallas.
   - Curvas de varios radios, horquillas, chicanes, rectas y zonas de derrape.
   - 30–45 s por vuelta y 3–5 vueltas, o una etapa punto a punto de 2–3 min.

9. **Checkpoints como puertas.**
   - Segmentos con anchura y dirección, no círculos de 80 px.
   - Detección de corte y aviso de "dirección contraria".
   - Penalización o invalidación de vuelta si se corta.

10. **Estructura de carrera.**
    - Pantalla de resultados con tiempo total, vueltas, mejor vuelta, delta y
      medalla.
    - Botones: reintentar, siguiente circuito, menú.
    - Pausa con reanudar, reiniciar y salir.

11. **Rejugabilidad.**
    - Fantasma de la mejor vuelta.
    - Medallas por tiempo objetivo.
    - Récords separados por tuning o solo válidos con el preset por defecto.
    - Progresión simple por circuito.

### P2 — Identidad visual y UI

12. **Coche nuevo.** Silueta cenital legible: ruedas, parabrisas, faros, número
    en el techo, sombra. Animación de ruedas/volante y polvo.
13. **Tileset y decoración.** Bordillos, líneas, arcenes, vallas, árboles,
    rocas, señales, arco de meta. Usar `theme` de verdad.
14. **UI 90s coherente.** Tipografía pixel, paleta limitada, paneles con marco,
    iconos dibujados (no emoji), logo y pantalla de título con attract mode.
15. **HUD responsive.** Que escale con el canvas y no tape la acción;
    velocímetro legible en móvil.
16. **Controles móviles.** Zona inferior dedicada, freno de mano fuera de la
    trazada, safe areas, opción de ocultar, pausa.
17. **Ajustes para jugadores.** Presets "Arcade / Rally / Simulación",
    restaurar valores, etiquetas claras, no sliders crípticos.

### P3 — Audio, accesibilidad y pulido

18. **Motor con marchas y carga**, no un loop de 70 ms. Derrape con pitch por
    deslizamiento, impactos, fuera de pista, ambientes y música chiptune.
    Volumen separado de música/SFX.
19. **Tutorial y ayudas.** Qué es el freno de mano, cómo derrapar, objetivo de
    la carrera, indicador de dirección.
20. **Accesibilidad.** Remapeo de teclas, alto contraste, reducción de
    movimiento, subtítulos/indicadores visuales, volumen.
21. **Localización consistente** (todo español o todo inglés).
22. **Limpieza técnica.** Eliminar `theme`/`wheelbaseOffset` muertos o
    implementarlos; validación de contenido de circuitos; dividir el bundle si
    interesa.

---

## 6. Plan de ataque recomendado

**Sprint 1 — Feel (P0):** colisiones sólidas + paso fijo + re-tuning de físicas +
velocímetro + input con rampa. Objetivo: que coger el coche y dar una vuelta sea
divertido por sí solo.

**Sprint 2 — Circuitos (P1):** rediseñar los 3 circuitos, puertas reales,
anti-corte, duración de 2–3 min y pantalla de resultados.

**Sprint 3 — Identidad (P2/P3):** coche/tileset/UI/audio/móvil.

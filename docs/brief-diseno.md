# Brief de diseño — trainmusiq / centrail

**Para:** sesión de Claude Design (exploración de identidad; NO se implementa en la app hasta después del release v1)
**Contexto completo del proyecto:** ver `docs/especificacion.md` v1.7 en el repo `trainmusiq/centrail`

---

## 1. Qué es esto

**TrainMusiq** es una marca paraguas de herramientas web de análisis y corrección musical, open source, que corren 100% en el navegador del usuario (su audio nunca sale de su equipo). Cada producto es un **vagón** del tren. El primero, ya construido y por publicar:

**Centrail** — diagnostica la afinación de referencia de una grabación (¿está en A=440 Hz o desviada?) y la corrige hacia cualquier frecuencia de destino (440, 432, 442…) sin alterar el tempo. Su diferenciador probado: mide con honestidad ANTES de tocar el audio, muestra la incertidumbre, y le dice al usuario "tu archivo ya está bien, no lo toques" cuando corresponde — cosa que la competencia de pago (Moises) no hace: en nuestra validación, Moises tomó un archivo perfecto y lo desafinó.

Vagones futuros: separación de stems, detección de acordes, tablatura de piano con digitación, y un programa pedagógico que enseña teoría musical a través de las canciones que el propio usuario sube.

## 2. Los nombres y su lógica (material para el logo)

**Corrección conceptual del fundador (importante):** las herramientas NO son "vagones del tren". trainmusiq es un **ecosistema** de herramientas para aprender/entrenar música con inspiración ferroviaria aplicada donde calza en cada una. La metáfora profunda del tren pertenece a la armonía: **la progresión de acordes ES el tren — cada acorde un vagón, la concatenación es el viaje**; la música como arte temporal que te lleva por paisajes lo que dura la canción. Esta imagen es material central para la identidad (especialmente de chordtrain).

- **trainmusiq** (SIEMPRE en minúsculas, como palabra única — decisión de marca): train = tren Y entrenar (doble sentido intencional: el ecosistema te entrena en música). El lowercase funde las dos palabras en un concepto nuevo y alinea con la lengua franca de las marcas de audio digital (spotify, moises, deezer). Hallazgo tipográfico del fundador a explorar en el logotipo: **la diagonal t→q** — la t con su asta ascendente al inicio, la q con su descendente al final; en minúsculas la palabra tiene un solo punto alto (t), un solo punto bajo (q), y el punto de la i flotando en medio como una nota en el pentagrama. Material de juego para el logo.
- **centrail** (publicada): cent (unidad de afinación) + rail; la afinación como el riel que guía/tempera la canción.
- **trackjunction** (candidato, stems): el empalme ferroviario que divide la canción en vías — y "track" es pista de audio Y vía férrea, doble sentido perfecto.
- **chordtrain** (candidato, armonía): entrenar acordes + el tren armónico funcional.
- **triptheory** (candidato, pedagogía): la teoría para el viaje musical.
- **pianowagon** (candidato, tablatura): coincidencia fonética piano/wagon; trasponer al piano los acordes del tren.

## 2b. Dirección estética (hipótesis del fundador + síntesis, para explorar con alternativas)

Crítica aceptada: la identidad del prototipo funciona pero es "demasiado Claude" — se necesita algo contemporáneo, único, diferenciador y atractivo. Dos polos considerados y descartados como totales: (a) futurismo pulido tipo gradientes/glow (estética default de la era IA, envejece rápido, es el "hacerse el bakán" que la marca contradice); (b) grunge noventero total (la imperfección anti-IA tiene fundamento cultural real, pero aplicada a la interfaz funcional pelea con la sencillez de uso).

**Hipótesis de síntesis a explorar: "instrumento de precisión con actitud".** El núcleo funcional impecablemente limpio y legible — donde se mide y se decide, pulcritud absoluta: los números son sagrados. La personalidad rebelde/grunge vive en la periferia: texturas de fotocopia/stamp en titulares, splash y marketing; tipografía con carácter; copy con voz propia; detalles análogos imperfectos. Referencia de actitud: un pedal de guitarra boutique — circuito de cirugía, carcasa de serigrafía rebelde. Anti-IA-genérico sin sacrificar usabilidad.

**Voz y tono del copy (mandato del fundador):** **sincero, directo y afectivo** — disuasivo más que imperativo, chill, con el cariño y la responsabilidad afectiva y política del grunge de Pearl Jam (no la indiferencia del de Nirvana). Y NUNCA sobre-explicativo: la calidez no es agregar palabras. Ejemplo de calibración: ✗ imperativo: "no lo toques" · ✗ sobre-explicado: "corregirlo solo lo haría pasar por la máquina de nuevo, sin nada que ganar" · ✓ el tono: "Ya está afinado. Déjalo así." El detalle técnico existe, pero secundario y opcional (expandible), nunca en la frase principal. Presentar 2-3 direcciones alternativas además de esta; la decisión final es visual, no verbal.

## 3. Audiencia

Músicos, productores caseros, coleccionistas de audio de alta resolución, estudiantes de música, y gente que baja música de internet y sospecha que "algo suena raro". Global (la app parte en español + inglés, luego 10 idiomas). No son ingenieros de audio profesionales necesariamente — la sencillez manda.

## 4. Principios de diseño (no negociables, en orden)

1. **Honestidad visible.** La app nunca oculta su estado ni maquilla sus números. Esto ya es identidad funcional: diagnóstico antes de corrección, incertidumbre declarada (± cents), consistencia de la medición, advertencias cuando el archivo ya está bien o la medición no es confiable. El diseño debe hacer que esta honestidad SE VEA como rasgo de personalidad, no como letra chica.
2. **Progreso real, jamás spinner.** Barra/anillo con porcentaje verdadero, etapa nombrada (Decodificando / Analizando / Corrigiendo / Codificando) y tiempo restante. Estados por color: ámbar = en progreso, cian = listo, rojo = error (mensajes en lenguaje humano: qué pasó y qué hacer), advertencia = avisos de honestidad. La competencia pone spinners bonitos que giran igual a los 5 segundos que a los 5 minutos — nosotros no.
3. **"Tu computador hace el trabajo" debe estar clarísimo en la UX.** El modelo económico es transparente: gratis = tu equipo procesa (por eso puede tardar unos minutos y por eso tu audio jamás sale de tu equipo); premium futuro = nuestro servidor procesa por ti (velocidad). El usuario debe entender sin leer un manual: (a) su archivo NO se sube a ningún lado — privacidad total como orgullo visible, no como nota al pie; (b) la velocidad depende de SU máquina, y la barra honesta es el contrato de esa espera. Buscar el momento y el copy exactos para comunicarlo (ej. junto al progreso: "Procesando en tu equipo — tu audio no ha salido de aquí").
4. **Sencillez radical.** Un flujo: soltar archivo → ver diagnóstico → decidir → descargar. Sin cuentas, sin configuración previa, sin jerga innecesaria. Lo avanzado (histograma, deriva, R) presente pero jerárquicamente secundario.

## 5. Identidad actual (punto de partida, no camisa de fuerza)

El prototipo estableció una dirección "instrumento de banco de pruebas" que funciona y tiene alma:
- Fondo grafito `#16181d`, paneles `#1e2128`, tinta cálida `#e9e5d9`
- **Ámbar de aguja VU `#f2a33c`** (lecturas, el dato protagonista)
- **Cian de traza de osciloscopio `#5fd4c4`** (datos, análisis)
- Rojo suave `#e06a5a` (desviación, error)
- Tipografías: Archivo (UI) + IBM Plex Mono (lecturas numéricas)
- **Elemento firma: el dial de aguja** de desviación en cents (como afinador de cinta análogo / VU meter). Cuando el tema está afinado, la aguja queda centrada — la metáfora de Centrail hecha interfaz.

Decisión pedida: conservar, evolucionar o reemplazar — pero con argumentos. El fundador valora esta estética; si se propone otra, debe ganarle en las cuatro dimensiones de los principios.

## 6. Referentes (lenguajes que la audiencia ya habita)

- DAWs y plugins de audio contemporáneos (Ableton, FabFilter, u-he: oscuro, preciso, datos hermosos)
- Apps masivas de práctica/análisis: Moises, Chordify, Yousician (aprender qué comunican bien — accesibilidad — y qué hacen mal: opacidad de proceso, spinners mentirosos)
- Pedagogía musical popular de YouTube (calidez, cercanía, cero solemnidad académica)
- Instrumentos de medición análogos: afinadores strobe (Peterson), VU meters, osciloscopios — el ADN del prototipo

## 7. Entregables pedidos a esta sesión de Design

1. **Logotipo trainmusiq** (lowercase, explorando la diagonal t→q) + variante isotipo (¿el tren? ¿un vagón?) para favicon/avatar.
2. **Lockup centrail** como producto de trainmusiq (cómo conviven marca paraguas y vagón: "centrail — by trainmusiq" u otra fórmula; evaluar si centrail también va en lowercase por coherencia de sistema).
3. **Sistema visual**: paleta definitiva (partiendo de la actual), jerarquía tipográfica, y el sistema de estados de color (ámbar/cian/rojo/advertencia) formalizado.
4. **UI de la app Centrail**: pantalla de inicio (drop zone), pantalla de diagnóstico (dial + histograma + deriva + métricas de honestidad), pantalla de corrección (selector de frecuencia destino con presets 432/440/442/444 + valor libre, progreso honesto), estados de error/advertencia.
5. **Landing simple** (una pantalla): qué es, por qué es distinto (honestidad + privacidad + gratis), botón de usar. Bilingüe es/en.

## 8. Restricciones técnicas

- Web estática (GitHub Pages), sin backend. Tipografías auto-hosteadas (no Google Fonts CDN). Assets livianos.
- Licencia GPL v3 y open source: la identidad debe verse profesional pero no corporativa-cerrada; espíritu "regalo al mundo" con calidad de producto pagado.
- Debe funcionar en pantalla de notebook y móvil (responsive), modo oscuro como base (la audiencia de audio vive en dark mode).
- Accesibilidad: los estados NUNCA se comunican solo por color (ámbar/cian/rojo siempre acompañados de texto/ícono); contraste AA mínimo.

## 9. Qué NO hacer

- Spinners indeterminados o cualquier ocultamiento de estado.
- Promesas de "100% preciso" o "calidad perfecta" — el lenguaje de la marca es de medición honesta (± cents, confianza declarada).
- Estética genérica de startup SaaS (gradientes morados, ilustraciones 3D de personitas).
- Clichés ferroviarios literales (locomotoras a vapor, señalética de estación vintage) — el tren es estructura conceptual y guiño, no disfraz.
- Sobrecargar la primera pantalla: el drop zone es el héroe.

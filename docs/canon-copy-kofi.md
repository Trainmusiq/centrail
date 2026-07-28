# Cierre de la divergencia del copy de Ko-fi — listo para aplicar en el repo padre

**Estado:** decidido por el fundador el 28 de julio de 2026 (sesión centrail v1.3.3). Aplicado ya en centrail; **pendiente de aplicar en `trainmusiq/trainmusiq`**, que es donde vive el canon del ecosistema.

**Por qué existe este archivo:** esta sesión corrió desde el repo de centrail y no edita el repo padre. El reemplazo queda escrito acá, listo para pegar, para que se aplique en una sesión del repo `trainmusiq/trainmusiq`. Una vez aplicado, este archivo se puede borrar.

---

## Motivo del cambio (sustantivo, no estético)

El copy canónico anterior ofrecía *"Suscríbete para más opciones y mayor velocidad"*: **prometía un tier de pago que todavía no existe**. La suscripción se construye recién en v2.5, que aún no está abierta (y que además está *gated* por el contador de demanda, §3.8 del propio roadmap). Anunciar en el footer de una herramienta publicada un beneficio que nadie puede comprar todavía es una promesa sin respaldo — justo el tipo de cosa que la marca dice no hacer (§0, diferenciador #2: honestidad estructural).

Retirarlo corrige esa promesa y, de paso, acorta el mensaje.

---

## Reemplazo exacto en `docs/roadmap.md` §3, punto 12

**Buscar** (línea 122 al momento de escribir esto):

```
12. **Ko-fi visible en toda herramienta gratuita (decisión registrada, 16 jul 2026):** cada app del ecosistema debe mostrar de forma visible (footer, mismo patrón visual que centrail) el enlace a ko-fi.com/trainmusiq como alternativa a la suscripción — mismo espíritu en todas: la suscripción (cuando exista) da más opciones y velocidad; el café es para quien el tier gratis ya le basta y quiere apoyar. Copy canónico bilingüe es/en: **"Suscríbete para más opciones y mayor velocidad. Y si con la versión gratuita te basta, siempre puedes invitarnos un café ☕."** / "Subscribe for more options and more speed. And if the free version is already enough for you, you can always buy us a coffee ☕." Se implementa en cada herramienta cuando tenga UI (chordwagon: pendiente, aún sin `index.html`).
```

**Reemplazar por:**

```
12. **Ko-fi visible en toda herramienta gratuita (decisión registrada 16 jul 2026; copy actualizado 28 jul 2026):** cada app del ecosistema debe mostrar de forma visible (footer, mismo patrón visual que centrail) el enlace a ko-fi.com/trainmusiq. El copy agradece si la herramienta sirvió, y **no promete nada que todavía no exista**: el texto anterior ofrecía "más opciones y mayor velocidad" por suscripción, un tier que se construye recién en v2.5 y que además está gated por el contador de demanda (§3.8) — anunciarlo en una herramienta ya publicada era una promesa sin respaldo. Copy canónico bilingüe es/en: **"Si te sirvió la herramienta, invítanos un café ☕."** / "If this tool helped you, buy us a coffee ☕." Cuando exista un tier de pago real y comprable, la mención a la suscripción vuelve — con el producto detrás. Se implementa en cada herramienta cuando tenga UI (chordwagon: pendiente, aún sin `index.html`).
```

---

## Efecto en los otros repos

La **regla 14 del `CLAUDE.md`** de `trackjunction` y `chordwagon` (y del propio centrail) remite a este punto del roadmap en vez de duplicar el texto, así que **heredan el copy nuevo automáticamente** al aplicar el reemplazo de arriba. No hace falta editarlos.

Sí conviene revisar el enunciado de la regla 14 en cada `CLAUDE.md`, porque hoy parafrasea el mensaje viejo: *"la suscripción da más opciones y velocidad, el café es para quien el tier gratis ya le basta"*. Sugerido:

```
14. **Ko-fi visible siempre (registrada 16 jul 2026, copy actualizado 28 jul 2026)**: el footer debe mostrar el enlace a ko-fi.com/trainmusiq con el copy canónico bilingüe (ver `roadmap.md` §3.12 de `trainmusiq/trainmusiq`) — agradece si la herramienta sirvió, sin prometer tiers que aún no existen.
```

## Estado por repo

| Repo | Estado |
|---|---|
| `centrail` | ✓ copy nuevo aplicado en los 10 idiomas (v1.3.2) y regla 14 actualizada (v1.3.3) |
| `trainmusiq/trainmusiq` (`roadmap.md` §3.12) | ⏳ pendiente — aplicar el reemplazo de arriba |
| `trackjunction` (`CLAUDE.md` regla 14) | ⏳ pendiente — hereda el copy; conviene actualizar el enunciado |
| `chordwagon` (`CLAUDE.md` regla 14) | ⏳ pendiente — hereda el copy; aún sin UI |

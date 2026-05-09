# Design Critique – CopyMail v2

Geprüftes Material: `CopyMail-v2/src/App.tsx`, `CopyMail-v2/src/index.css`,
`CopyMail-v2/index.html`. Die App ist ein kleines Electron-Desktop-Tool
(Glas-Karte auf dunklem Hintergrund, fixe Initialgröße 540×720, Indigo/Purple-
Akzentfarben, deutsche UI). Kein Onboarding, ein einziger Workflow:
*Drop → Preview → Copy*.

---

## Erster Eindruck (≈ 2 Sekunden)

Die App wirkt premium und ruhig. Der Blick landet zuerst auf dem
*Mail-Icon-Wrapper* (gradienter Indigo→Purple-Hintergrund, abgerundet, leichter
Glow), unmittelbar darunter auf der H1 *„CopyMail"* mit Gradient-Text und der
Drop-Zone mit dem dashed Border. Die Hauptaktion ist sofort erkennbar.

Das funktioniert. Was noch nicht trägt: in der **Preview-Ansicht** konkurrieren
gleich vier visuelle Schwergewichte in der Toolbar (Drag-Handle, Mode-Toggle,
Copy-CTA, Reset-Icon). Die ursprüngliche Klarheit der Drop-Zone-Ansicht geht
verloren.

---

## Usability

| Finding | Severity | Empfehlung |
|---|---|---|
| Reset-Button hat **`Trash2`-Icon** mit Tooltip „Neue Datei". Mülltonne signalisiert datenzerstörende Aktion und schreckt ab, wenn die User „nochmal von vorne" wollen | 🟡 Moderate | `RotateCcw` oder `Plus` benutzen. Die Hover-Farbe sollte dann nicht mehr Danger-Rot sein. |
| **Copy-Button im `isCopying`-State zeigt rotierendes `Upload`-Icon**. Upload-Symbol für „Lade gerade etwas in die Zwischenablage" ist semantisch falsch | 🟢 Minor | Lucide `Loader2` (stroke-Width 2, animate-spin) verwenden. |
| **„Text"/„Datei"-Toggle und Copy-Button stehen direkt nebeneinander** in der Toolbar. Der Toggle wirkt visuell wie eine zweite primäre Aktion, was Aufmerksamkeit von der eigentlichen CTA wegzieht | 🟡 Moderate | Toggle visuell zurücknehmen (kleinere Pill, mehr Spacing zwischen Toggle und Copy-Button) **oder** den Toggle in eine Zeile darüber/darunter verschieben. |
| **Drag-Handle hat keine Drag-Affordance**. Das 36×36-Quadrat mit Mail-Icon sieht aus wie ein Button. Tooltip erscheint erst nach Hover | 🟡 Moderate | `cursor: grab` (und `cursor: grabbing` während des Drags), zusätzlich ein dezentes Drag-Pattern (z. B. zwei kleine `grip-vertical`-Punkte am Rand) oder den Hint „Ziehen, um anzuhängen" sichtbar neben dem Handle. |
| **Pin/PinOff-Icon ist invertiert zur Intuition**. `PinOff` (durchgestrichene Pin) wird gezeigt, wenn *noch nicht* gepinnt – das ist verwirrend, weil das Icon „aktive Aktion: Pin entfernen" suggeriert | 🟢 Minor | Konsistent ein Icon (z. B. nur `Pin`) und den Aktiv-Zustand über Hintergrundfarbe/Pressed-State signalisieren. |
| **Der „Datei"-Mode-Button ist disabled, ohne dass der Grund unmittelbar sichtbar ist**. Der Tooltip kommt erst nach 700 ms Hover; für Tastatur-User gar nicht | 🟡 Moderate | Inline-Hinweis unter der Toolbar, wenn `!filePath` und `copyMode==='file'`-Versuch lief; oder Lock-Icon im Button. |
| **Drop-Zone reagiert nicht auf `Space`**, obwohl sie `role="button"` hat. WAI-ARIA verlangt für Buttons sowohl Enter als auch Space | 🟡 Moderate | `onKeyDown`: `if (e.key === 'Enter' || e.key === ' ')`. |
| **Always-on-Top-Toggle und das Mail-Icon teilen sich denselben Header**. Der Toggle ist absolute-positioniert rechts, das Icon zentriert – der Header wirkt unausbalanciert (links leer) | 🟢 Minor | Entweder beide Elemente in eine Flex-Reihe (Icon links, Toggle rechts, Titel mittig) oder den Toggle in die Titlebar wandern lassen, falls Frameless-Window möglich. |
| **„Kopieren"-CTA hat `pulse`-Animation dauerhaft**. Pulse signalisiert „Achtung, klick mich" – im Idle-State *nach* einer erfolgreichen Kopie ist das laut. Keine Reduktion bei `prefers-reduced-motion` | 🟡 Moderate | Pulse nur auf erste 3 s nach `formattedContent`-Set; bei `@media (prefers-reduced-motion: reduce)` komplett deaktivieren. |
| **Footer-Text** „Lokal & Sicher · Keine Daten verlassen Ihren Rechner" sehr klein und mit nur 0.35 Alpha kaum lesbar | 🟢 Minor | Alpha auf ≥0.6 anheben oder Größe auf 0.82rem. |

---

## Visual Hierarchy

- **Was zuerst auffällt** – Mail-Icon + H1 (korrekt für die Drop-Ansicht).
  In der Preview-Ansicht zieht der **Pulse-Glow auf dem Copy-Button** den Blick,
  was richtig ist – aber die Mail-Meta-Box konkurriert farblich (Indigo-Tinted-
  Background) damit.
- **Lesefluss** – Header → Mail-Meta → Body. Sauberer Top-Down-Flow. Die
  Toolbar liegt zwischen Header und Meta und unterbricht ihn etwas; sie sieht
  aktuell aus wie ein Sub-Header für die Vorschau, was OK ist, aber ihre
  Schwerpunkt-Verteilung (Drag-Handle links, Mode-Toggle mittig, Copy + Reset
  rechts) hat zu viele Pole.
- **Hervorhebung der Meta-Box** ist zu stark. Das *Beispielsuhujekt* in
  Bold-Weiß auf Indigo-Tint zieht denselben Blick wie der Mail-Body. Body
  sollte dominieren.
- **Plain-Text Body in der Vorschau auf dunklem Hintergrund** funktioniert –
  bei sanitisiertem **HTML-Body bleibt der Mail-eigene Inline-Style erhalten**
  (typischerweise `color: #000` auf dunklem Karten-BG ⇒ schwarze Schrift auf
  fast-schwarz, **unleserlich**). Größtes UX-Risiko der App.
  → Body-Container auf hellen Hintergrund (z. B. `#f7f8fb`) wechseln, sobald
  HTML gerendert wird, oder ein „Light-Card"-Wrapper für die Mail-Body-Region.

---

## Consistency

| Element | Inkonsistenz | Empfehlung |
|---|---|---|
| **Border-Radius** | `--radius-lg/md/sm` Tokens existieren (20/12/8). Aber genutzt werden zusätzlich `18px` (icon-wrapper), `10px` (mode-toggle), `7px` (toggle-button), `100px` (pin, banner), `999px` (badge), `6px` (hint, scrollbar). Acht effektive Werte, keine Tokens für Pill/Round | Tokens erweitern: `--radius-xs: 6px`, `--radius-pill: 9999px`. Alle One-Offs ersetzen. |
| **Spacing** | Magic numbers überall: `2.5rem`, `2rem`, `1.25rem`, `1rem`, `0.875rem`, `0.75rem`, `0.5rem`, `0.4rem`, `0.35rem`, `0.3rem`, `0.25rem`. Keine Skala | Spacing-Tokens einführen (`--space-1: 4px` … `--space-8: 48px`) und die Werte konsolidieren. |
| **Schriftgrößen** | 7 unterschiedliche `font-size`: 0.75, 0.78, 0.8, 0.875, 0.9, 0.95, 1, 2.2. Differenzen unter 0.1rem sind nicht wahrnehmbar, aber pflegeintensiv | Skala auf 5 Stufen reduzieren: 0.75, 0.875, 1, 1.25, 2.25. |
| **Button-Höhen in der Toolbar** | `.btn-primary` ≈ 38px, `.btn-icon` 36px, `.copy-mode-toggle button` ≈ 28px, `.btn-pin` ≈ 30px. Alles unterschiedlich | Alle Toolbar-Buttons auf 36px Höhe normalisieren. |
| **Text-Muted-Farbe** | `var(--text-muted)` mit Alpha 0.8, daneben Hardcoded `rgba(148, 163, 184, 0.45)`, `0.35`, `0.95` – vier Versionen | Tokens `--text-muted`, `--text-disabled`, `--text-faint`. |
| **Hover-Effekte** | Manche Elemente nutzen `transform: translateY(-2px)`, andere `scale(1.05)`, manche nichts. Reset-Hover wechselt komplett zu Rot | Hover-Pattern definieren: Sekundär-Buttons heben sich, primäre haben `filter: brightness`. Reset-Button sollte nicht „danger" hover-Farbe bekommen, weil die Aktion selbst nicht destruktiv ist (s. Usability). |
| **Stroke-Width der Icons** | `Mail size={26} strokeWidth={1.8}`, andere ohne `strokeWidth`. lucide-default ist 2 | Eine Stroke-Width-Konvention: 1.75 für Header, 2 für Inline-Buttons. |

---

## Accessibility

| Aspekt | Status | Anmerkung |
|---|---|---|
| **Primärtext-Kontrast** (`--text-primary` rgba(255,255,255,.92) auf `--bg-card`) | ✅ vermutlich ≥ 12:1 | Stark genug. |
| **Muted-Text** (`rgba(148,163,184,.8)` auf BG) | ⚠️ ≈ 4:1 | Knapp WCAG AA für normalen Text – noch OK. |
| **Disabled „Datei"-Button** (`rgba(148,163,184,.45)`) | ❌ ≈ 2:1 | Unter AA. WCAG erlaubt für deaktivierte Controls eigentlich Ausnahmen, aber das Design liest sich wie „verfügbar, aber blass". Besser deutlicher Disabled-Stil mit Lock-Icon und stärkerem Kontrast. |
| **Footer** (`rgba(148,163,184,.35)`) | ❌ ≈ 1.6:1 | Klar unter AA, sollte mindestens 4.5:1 für Body-Text. |
| **Touch-Targets** | ⚠️ 28–36px | WCAG 2.1 AA verlangt 24×24, AAA 44×44. Aktuell überall AA, aber `.copy-mode-toggle`-Buttons sind 28px hoch – grenzwertig für Touch. Auf Desktop OK. |
| **Focus-Indicator** | ⚠️ Default-Browser | Dark-Theme-Default-Outline ist auf manchen Browsern dunkles Schwarz und auf dunklem BG kaum sichtbar. Eigener `:focus-visible`-Ring nötig. |
| **`prefers-reduced-motion`** | ❌ nicht respektiert | Framer-Motion-Initial-Animationen (`opacity 0 → 1`, `y 30 → 0`), `pulse-glow`-Animation, `rotate 360`-Loader laufen unabhängig. Mit `useReducedMotion` aus framer-motion gating. |
| **Drop-Zone Tastatur** | ⚠️ nur Enter, kein Space | s. Usability. |
| **Color-only Information** | ✅ | „Kopiert!" hat Icon + Text + Farbe. „Datei"-disabled hat Tooltip. |
| **Alt-Text** | ✅ | Mail-Drag-Handle-Icon hat `alt="Mail"`, decorative Lucide-Icons sind SVG ohne Alt – akzeptabel. |
| **`aria-pressed`/`aria-label`** | ✅ | Pin-Button und Drop-Zone gut markiert. |
| **`role="alert"` für Fehler** | ✅ | Im neuen Code aktiviert. |
| **Fonts vom CDN** | ⚠️ Privacy | Google Fonts via `googleapis.com`. Im Electron-Renderer mit „lokal & sicher"-Versprechen ein Bruch der Story. Inter könnte lokal gebundelt werden (`fontsource/inter`). |

---

## Was funktioniert gut

- **Klare Single-Workflow-Architektur**: keine Sidebar, keine Tabs, keine
  Modale. Drop → Preview → Copy ist eine Linie.
- **Glass-Card auf weichem Radial-Gradient-BG** transportiert Premium-Gefühl
  ohne aufdringlich zu sein.
- **Subtile Mikro-Animationen** an Drop-Zone-Hover (Border solidet, leichtes
  Heben) sind richtig dosiert.
- **Mode-Badge „BROWSER-MODUS"** als pill ist eine elegante Lösung für ein
  Diagnose-Signal, das nicht den Workflow stört.
- **Mail-Meta-Grid** mit `auto 1fr` Spalten ist sauber und respektiert
  unterschiedliche Label-Längen.
- **Erfolgs-Toast „Kopiert!"** mit Slide-up und auto-dismiss in 2.5 s ist
  ergonomisch (kein dauerhafter Banner, kein klick-zum-schließen-Aufwand).
- **Eindeutige Akzentfarben-Palette** (Indigo + Purple + ein Cyan-Akzent in H1).
  Kein chaotischer Farbenlärm.

---

## Priorisierte Empfehlungen

1. **Mail-Body lesbar machen.** HTML-Mails kommen mit dunkler Schrift; auf der
   dunklen Karte werden sie unleserlich. Den `.preview-container` für
   HTML-Bodies auf einen hellen Hintergrund (z. B. `#f7f8fb` mit `color: #1f2937`)
   wechseln. Plain-Text-Bodies können auf dem dunklen Look bleiben oder
   gleichbehandelt werden für Konsistenz. **Größtes UX-Problem, kleinster Fix.**

2. **Reset-Icon und Copy-Loading-Icon korrigieren.** `Trash2 → RotateCcw` (mit
   neutraler Hover-Farbe), `Upload (rotierend) → Loader2`. Beides klar
   semantisch falsch heute.

3. **Design-Tokens vervollständigen.** Spacing-Skala (4 → 48 px in 7 Stufen),
   Pill-Radius-Token, drei Text-Token (`primary`, `muted`, `disabled`). Danach
   den CSS-Code einmal scharf-stellen und alle Magic-Numbers ersetzen. Macht
   alle weiteren Änderungen leichter.

4. **Toolbar-Heights und Button-Hierarchie aufräumen.** Alle Toolbar-Buttons
   auf 36 px Höhe, klar gestufte visuelle Schwere: Copy = primary (gradient,
   bold), Reset = ghost-icon, Mode-Toggle = segmented-control mit weniger
   Kontrast. Das stellt die CTA wieder in den Mittelpunkt.

5. **`prefers-reduced-motion` respektieren.** Pulse-Glow, Loader-Spin und
   Framer-Motion-Initial-Animationen über `useReducedMotion()` aus framer-motion
   gating. Nicht nur a11y, auch Akku/CPU-Schonung in Always-on-Top-Mode.

6. **Disabled-State und Footer-Kontrast auf WCAG AA heben.** Mindestens 3:1
   für UI-Komponenten, 4.5:1 für Body-Text. Aktuell falsch (≈ 2:1 / 1.6:1).

7. **Eigener Focus-Indicator** (`:focus-visible { outline: 2px solid var(--accent-indigo); outline-offset: 2px; }`). Default ist auf Dark-Theme oft unsichtbar.

8. **Drag-Handle als Drag erkennbar machen.** `cursor: grab`, kleine
   `grip-vertical` Linien, Tooltip früher sichtbar (z. B. dauerhaft als
   Hint-Label „Ziehen zum Anhängen" rechts vom Handle).

9. **Google-Fonts lokal bundeln.** Konsistenz mit dem „lokal & sicher"-
   Versprechen, kein Layout-Shift beim Laden, eine externe Connection weniger
   in der CSP.

10. **Always-on-Top-Toggle ins Custom-Titlebar verschieben** (langfristig).
    Räumt den Header optisch auf und folgt der Konvention für sticky
    Window-Controls.

---

## Verdict

Sehr solide Basis – die App sieht aus wie ein 2025-Produkt und nicht wie ein
WinForms-Tool. Die echten Hebel liegen jetzt nicht im Look-and-Feel, sondern
darin, die Vorschau für reale Mail-HTML lesbar zu halten und die Toolbar-
Hierarchie zu schärfen. Token-Konsolidierung und A11y-Feinschliff sind
mechanische Folgearbeit, die einmal durchgezogen die Pflege langfristig
beschleunigt.

# TourneyJS

Analizador léxico (AFD manual) para interpretar archivos de torneos y generar reportes de: bracket, estadísticas por equipo, goleadores e información general. Interfaz web sin frameworks. **No se usan regex ni parsers automáticos para el análisis**; la tokenización se hace con un AFD manual carácter por carácter.

## Uso
1. Abre `index.html` en tu navegador (doble clic).
2. Carga un archivo de torneo o usa el ejemplo precargado.
3. Presiona **Analizar**.
4. Si no hay errores léxicos, podrás exportar:
   - `tokens.html`, `errores.html`
   - `reportes.html`
   - `bracket.dot` (para Graphviz)

## Estructura
- `index.html`, `style.css`, `app.js`
- `docs/manual_usuario.html`
- `docs/manual_tecnico.html`
- `assets/afd.dot` (grafo del AFD usado)

## Restricciones
- El lexer está implementado como AFD manual (sin expresiones regulares ni `.split()`, `.match()`, etc. para tokenizar).
- No se utilizan librerías de análisis léxico/sintáctico.


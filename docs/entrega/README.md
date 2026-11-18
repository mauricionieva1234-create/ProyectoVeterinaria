# Entrega · segundo parcial

Archivos para presentar el proyecto en Metodología de Sistemas II:

- **`Presentacion-Proyecto-Segundo-Parcial.pdf`** es el archivo para enviar.
- `Presentacion-Proyecto-Segundo-Parcial.html` es la fuente editable. Si hace falta corregir un dato, se edita y se vuelve a generar el PDF.

## Datos de la portada

- Proyecto: Sistema de gestión veterinaria (ProyectoVeterinaria)
- Materia: Metodología de Sistemas II
- Integrante: Mauricio Nieva · Legajo 63984 · Comisión 11
- Repositorio: https://github.com/mauricionieva1234-create/ProyectoVeterinaria

## Regenerar el PDF en Windows

Desde la carpeta del proyecto, con Microsoft Edge instalado:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$html = "file:///C:/PRYECTOS%20-%20TUP/veterinaria/docs/entrega/Presentacion-Proyecto-Segundo-Parcial.html"
$pdf = "C:\PRYECTOS - TUP\veterinaria\docs\entrega\Presentacion-Proyecto-Segundo-Parcial.pdf"
& $edge --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer --virtual-time-budget=5000 "--print-to-pdf=$pdf" $html
```

También se puede abrir el HTML en el navegador y usar *Imprimir → Guardar como PDF*.

El documento usa únicamente datos ficticios del proyecto.

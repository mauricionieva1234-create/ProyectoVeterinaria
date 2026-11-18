"""Genera el .docx editable a partir del HTML de la entrega.

El HTML es la fuente única de contenido: si se corrige un dato ahí, hay que
volver a correr este script y el convertidor de PDF.
"""

from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

BASE = Path(__file__).resolve().parent
ORIGEN = BASE / "Presentacion-Proyecto-Segundo-Parcial.html"
DESTINO = BASE / "Presentacion-Proyecto-Segundo-Parcial.docx"

TEAL = RGBColor(0x0F, 0x76, 0x6E)
OSCURO = RGBColor(0x0F, 0x17, 0x2A)
GRIS = RGBColor(0x47, 0x55, 0x69)


def sombrear_parrafo(parrafo, color):
    pr = parrafo._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    pr.append(shd)


def sombrear_celda(celda, color):
    pr = celda._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)
    pr.append(shd)


def repetir_encabezado(fila):
    pr = fila._tr.get_or_add_trPr()
    cabecera = OxmlElement("w:tblHeader")
    cabecera.set(qn("w:val"), "true")
    pr.append(cabecera)


def agregar_texto(parrafo, nodo, negrita=False, cursiva=False, monoespacio=False):
    """Recorre los hijos de un tag y respeta strong, em, code, a y br."""
    if isinstance(nodo, NavigableString):
        texto = str(nodo)
        if texto:
            run = parrafo.add_run(texto)
            run.bold = negrita
            run.italic = cursiva
            if monoespacio:
                run.font.name = "Consolas"
                run.font.size = Pt(8.5)
        return

    if not isinstance(nodo, Tag):
        return

    if nodo.name == "br":
        parrafo.add_run().add_break()
        return

    es_negrita = negrita or nodo.name in {"strong", "b"}
    es_cursiva = cursiva or nodo.name in {"em", "i"}
    es_mono = monoespacio or nodo.name == "code"

    for hijo in nodo.children:
        agregar_texto(parrafo, hijo, es_negrita, es_cursiva, es_mono)


def parrafo_de(doc, nodo, estilo=None):
    parrafo = doc.add_paragraph(style=estilo)
    agregar_texto(parrafo, nodo)
    return parrafo


def armar_tabla(doc, tabla, es_ficha=False):
    filas = tabla.find_all("tr")
    columnas = max(len(f.find_all(["td", "th"])) for f in filas)
    tabla_word = doc.add_table(rows=len(filas), cols=columnas)
    tabla_word.style = "Table Grid"
    tabla_word.alignment = WD_TABLE_ALIGNMENT.CENTER
    tabla_word.autofit = False

    anchos = [4.2, 13.6] if es_ficha else ([5.5, 12.3] if columnas == 2 else [4.6, 5.2, 8.0])
    for indice, ancho in enumerate(anchos):
        for celda in tabla_word.columns[indice].cells:
            celda.width = Cm(ancho)

    for numero_fila, fila in enumerate(filas):
        celdas = fila.find_all(["td", "th"])
        if numero_fila == 0 and not es_ficha:
            repetir_encabezado(tabla_word.rows[numero_fila])

        for numero_celda, celda_html in enumerate(celdas):
            celda = tabla_word.cell(numero_fila, numero_celda)
            celda.text = ""
            parrafo = celda.paragraphs[0]
            parrafo.paragraph_format.space_after = Pt(2)
            parrafo.paragraph_format.space_before = Pt(2)
            agregar_texto(parrafo, celda_html)

            if es_ficha and numero_celda == 0:
                for run in parrafo.runs:
                    run.bold = True
                    run.font.color.rgb = TEAL
                sombrear_celda(celda, "CCFBF1")
            elif numero_fila == 0 and not es_ficha:
                for run in parrafo.runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                sombrear_celda(celda, "0F766E")
            elif numero_fila % 2 == 0:
                sombrear_celda(celda, "F8FAFC")

    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def armar_diagrama(doc):
    """Versión editable del diagrama de capas (tabla en lugar de imagen)."""
    niveles = [
        ("FRONTEND · React + Vite", "páginas · componentes · hooks · api · rutas", "CCFBF1"),
        ("HTTP / JSON · REST", "", "F1F5F9"),
        ("BACKEND · Express", "", "F1F5F9"),
        ("RUTAS → CONTROLADOR", "autenticación · permisos · validación · respuesta HTTP", "FFFFFF"),
        ("SERVICIO · reglas de negocio", "transacciones y auditoría", "FFFFFF"),
        ("REPOSITORIO · SQL parametrizado", "sin ORM", "FFFFFF"),
        ("POSTGRESQL · tablas, FK, CHECK, índices", "", "E2E8F0"),
    ]
    tabla = doc.add_table(rows=len(niveles), cols=1)
    tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
    tabla.autofit = False
    tabla.columns[0].width = Cm(16)

    for indice, (titulo, detalle, color) in enumerate(niveles):
        celda = tabla.cell(indice, 0)
        celda.width = Cm(16)
        celda.text = ""
        parrafo = celda.paragraphs[0]
        parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        parrafo.paragraph_format.space_before = Pt(4)
        parrafo.paragraph_format.space_after = Pt(2)
        run = parrafo.add_run(titulo)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = OSCURO if color != "CCFBF1" else TEAL
        if detalle:
            detalle_parrafo = celda.add_paragraph()
            detalle_parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
            detalle_parrafo.paragraph_format.space_after = Pt(4)
            detalle_run = detalle_parrafo.add_run(detalle)
            detalle_run.font.size = Pt(8.5)
            detalle_run.font.color.rgb = GRIS
        sombrear_celda(celda, color)
        if indice < len(niveles) - 1:
            Flecha = celda.add_paragraph()
            Flecha.alignment = WD_ALIGN_PARAGRAPH.CENTER
            flecha_run = Flecha.add_run("↓")
            flecha_run.font.size = Pt(9)
            flecha_run.font.color.rgb = GRIS

    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def configurar_estilos(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = OSCURO
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15

    for nombre, tamaño, color, antes, despues in [
        ("Title", 22, TEAL, 0, 10),
        ("Subtitle", 13, GRIS, 0, 16),
        ("Heading 1", 14, TEAL, 14, 6),
        ("Heading 2", 11.5, TEAL, 10, 4),
    ]:
        estilo = doc.styles[nombre]
        estilo.font.name = "Calibri"
        estilo.font.size = Pt(tamaño)
        estilo.font.bold = True
        estilo.font.color.rgb = color
        estilo.paragraph_format.space_before = Pt(antes)
        estilo.paragraph_format.space_after = Pt(despues)
        estilo.paragraph_format.keep_with_next = True

    codigo = doc.styles.add_style("Codigo", 1)
    codigo.base_style = doc.styles["Normal"]
    codigo.font.name = "Consolas"
    codigo.font.size = Pt(8.5)
    codigo.paragraph_format.space_before = Pt(2)
    codigo.paragraph_format.space_after = Pt(2)
    codigo.paragraph_format.left_indent = Cm(0.3)
    codigo.paragraph_format.keep_together = True

    ruta = doc.styles.add_style("RutaCodigo", 1)
    ruta.base_style = doc.styles["Normal"]
    ruta.font.name = "Consolas"
    ruta.font.size = Pt(8)
    ruta.font.bold = True
    ruta.font.color.rgb = TEAL
    ruta.paragraph_format.space_before = Pt(4)
    ruta.paragraph_format.space_after = Pt(0)
    ruta.paragraph_format.keep_with_next = True


def main():
    sopa = BeautifulSoup(ORIGEN.read_text(encoding="utf-8"), "html.parser")
    doc = Document()

    seccion = doc.sections[0]
    seccion.page_width = Cm(21)
    seccion.page_height = Cm(29.7)
    seccion.top_margin = Cm(1.8)
    seccion.bottom_margin = Cm(1.8)
    seccion.left_margin = Cm(1.6)
    seccion.right_margin = Cm(1.6)
    configurar_estilos(doc)

    propiedades = doc.core_properties
    propiedades.title = "Documento de presentación de proyecto · Segundo parcial"
    propiedades.subject = "Metodología de Sistemas II · ProyectoVeterinaria"
    propiedades.author = "Mauricio Nieva · Legajo 63984 · Comisión 11"

    for indice_seccion, bloque in enumerate(sopa.body.find_all("section", recursive=False)):
        if indice_seccion > 0:
            doc.add_page_break()

        for nodo in bloque.children:
            if isinstance(nodo, NavigableString):
                continue
            if not isinstance(nodo, Tag):
                continue

            clases = nodo.get("class", [])
            nombre = nodo.name

            if "etiqueta" in clases:
                parrafo = parrafo_de(doc, nodo)
                parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                sombrear_parrafo(parrafo, "CCFBF1")
                for run in parrafo.runs:
                    run.bold = True
                    run.font.size = Pt(9)
                    run.font.color.rgb = TEAL
            elif nombre == "h1":
                parrafo = parrafo_de(doc, nodo, "Title")
                parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif "subtitulo" in clases:
                parrafo = parrafo_de(doc, nodo, "Subtitle")
                parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif nombre == "table" and "ficha" in clases:
                armar_tabla(doc, nodo, es_ficha=True)
            elif "pie-portada" in clases:
                for hijo in nodo.find_all("span", recursive=False):
                    parrafo = parrafo_de(doc, hijo)
                    parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in parrafo.runs:
                        run.font.size = Pt(9.5)
                        run.font.color.rgb = GRIS
            elif nombre == "h2":
                parrafo_de(doc, nodo, "Heading 1")
            elif nombre == "h3":
                parrafo_de(doc, nodo, "Heading 2")
            elif nombre in {"ul", "ol"}:
                estilo = "List Bullet" if nombre == "ul" else "List Number"
                for item in nodo.find_all("li", recursive=False):
                    parrafo_de(doc, item, estilo)
            elif nombre == "table":
                armar_tabla(doc, nodo)
            elif "codigo" in clases:
                ruta = nodo.find(class_="ruta")
                if ruta:
                    parrafo_de(doc, ruta, "RutaCodigo")
                pre = nodo.find("pre")
                if pre:
                    texto = pre.get_text()
                    parrafo = doc.add_paragraph(style="Codigo")
                    sombrear_parrafo(parrafo, "F1F5F9")
                    lineas = texto.split("\n")
                    for numero, linea in enumerate(lineas):
                        if numero:
                            parrafo.add_run().add_break()
                        parrafo.add_run(linea)
            elif "nota" in clases:
                parrafo = parrafo_de(doc, nodo)
                sombrear_parrafo(parrafo, "F0FDFA")
                parrafo.paragraph_format.left_indent = Cm(0.3)
                parrafo.paragraph_format.right_indent = Cm(0.3)
            elif nombre == "svg":
                armar_diagrama(doc)
            elif nombre == "p":
                parrafo = parrafo_de(doc, nodo)
                if "pie" in clases:
                    parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in parrafo.runs:
                        run.font.size = Pt(8.8)
                        run.font.color.rgb = GRIS

    doc.save(DESTINO)
    print(f"Generado: {DESTINO}")


if __name__ == "__main__":
    main()

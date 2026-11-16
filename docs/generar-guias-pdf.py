"""Genera los PDF de las guías para la defensa a partir de sus .md (en docs/pdf/).

    python docs/generar-guias-pdf.py

Usa el mismo estilo que el manual (docs/generar-manual-pdf.py) y además dibuja los bloques de
código (```sql, ```bash) en un recuadro con letra de máquina. Requiere reportlab.
"""
import importlib.util
import re
import sys
from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('manual', RAIZ / 'docs' / 'generar-manual-pdf.py')
manual = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(manual)
manual.OMITIR = ()  # en las guías no se saltea ninguna sección

GUIAS = [
    ('guia-base-de-datos.md', 'Guía de la base de datos', 'Cómo usarla en MySQL Workbench'),
    ('donde-esta-cada-cosa.md', 'Dónde está cada cosa', 'Cada funcionalidad, con su archivo y su línea'),
    ('practica-defensa.md', 'Práctica para la defensa', 'Preguntas para ubicar cada funcionalidad en el código'),
]

CODIGO = ParagraphStyle('codigo', fontName='Courier', fontSize=8, leading=10.5, textColor=manual.OSCURO)


def bloque_codigo(texto):
    t = Table([[Preformatted(texto, CODIGO)]], colWidths=[A4[0] - 40 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), manual.FONDO), ('BOX', (0, 0), (-1, -1), 0.5, manual.BORDE),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return [t, Spacer(1, 8)]


def convertir(md):
    """Separa los bloques de código (que pueden tener '#' o '--') y convierte el resto como el manual."""
    salida = []
    for i, parte in enumerate(re.split(r'^```[a-z]*\n(.*?)^```\n?', md, flags=re.S | re.M)):
        if i % 2:
            salida += bloque_codigo(parte.rstrip('\n'))
        elif parte.strip():
            # En la práctica, las respuestas empiezan en otra hoja (para no verlas al responder).
            antes, separador, despues = parte.partition('\n## Respuestas')
            salida += manual.convertir(antes)
            if separador:
                salida += [PageBreak()] + manual.convertir(separador + despues)
    return salida


def generar(archivo, titulo, sub):
    origen = RAIZ / 'docs' / archivo
    destino = RAIZ / 'docs' / 'pdf' / archivo.replace('.md', '.pdf')
    destino.parent.mkdir(parents=True, exist_ok=True)

    def pie(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(manual.ROJO)
        canvas.setLineWidth(2)
        canvas.line(20 * mm, A4[1] - 14 * mm, A4[0] - 20 * mm, A4[1] - 14 * mm)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(manual.GRIS)
        canvas.drawString(20 * mm, 10 * mm, f'BurgosCorp ERP · {titulo}')
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f'Página {doc.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(str(destino), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=18 * mm,
                            title=f'{titulo} · BurgosCorp ERP', author='BurgosCorp S.A.')
    contenido = [
        Spacer(1, 120 * mm),
        Paragraph(titulo, manual.E['portada']), Spacer(1, 6),
        Paragraph('BurgosCorp ERP', manual.E['subportada']), Spacer(1, 30),
        Paragraph(sub, manual.E['subportada']), Spacer(1, 6),
        Paragraph(f'Versión del {date.today().strftime("%d/%m/%Y")}', manual.E['subportada']),
        PageBreak(),
    ] + convertir(origen.read_text(encoding='utf-8'))
    doc.build(contenido, onFirstPage=manual.portada, onLaterPages=pie)
    print(f'PDF generado: {destino.relative_to(RAIZ)} ({destino.stat().st_size // 1024} KB)')


def main():
    for g in GUIAS:
        generar(*g)


if __name__ == '__main__':
    sys.exit(main())

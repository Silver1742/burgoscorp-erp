"""Genera el PDF del manual de usuario a partir de docs/manual-de-usuario.md.

    python docs/generar-manual-pdf.py

El PDF queda en backend/assets/manual-de-usuario.pdf: la API lo adjunta al email de "Tu cuenta
está habilitada". Volver a correrlo cada vez que cambie el manual. Requiere reportlab
(pip install reportlab).
"""
import re
import sys
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'docs' / 'manual-de-usuario.md'
DESTINO = RAIZ / 'backend' / 'assets' / 'manual-de-usuario.pdf'

# Secciones del .md que no van en el PDF que recibe un empleado nuevo.
OMITIR = ('Cuentas de prueba',)

ROJO = colors.HexColor('#c8102e')
OSCURO = colors.HexColor('#212529')
GRIS = colors.HexColor('#6c757d')
FONDO = colors.HexColor('#f1f1f3')
BORDE = colors.HexColor('#dee2e6')

E = {
    'portada': ParagraphStyle('portada', fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=OSCURO, alignment=TA_CENTER),
    'subportada': ParagraphStyle('subportada', fontName='Helvetica', fontSize=13, leading=18, textColor=GRIS, alignment=TA_CENTER),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=OSCURO, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=ROJO, spaceBefore=14, spaceAfter=6, keepWithNext=1),
    'h3': ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=OSCURO, spaceBefore=8, spaceAfter=4, keepWithNext=1),
    'p': ParagraphStyle('p', fontName='Helvetica', fontSize=10, leading=14, textColor=OSCURO, spaceAfter=6),
    'celda': ParagraphStyle('celda', fontName='Helvetica', fontSize=9, leading=12, textColor=OSCURO),
    'cabecera': ParagraphStyle('cabecera', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.white),
    'nota': ParagraphStyle('nota', fontName='Helvetica', fontSize=10, leading=14, textColor=OSCURO),
}


def en_linea(texto):
    """Markdown en línea → el mini-HTML que entiende reportlab."""
    t = texto.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'&lt;(https?://[^&]+)&gt;', r'<link href="\1" color="#c8102e">\1</link>', t)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<link href="\2" color="#c8102e">\1</link>', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)  # enlaces a otros archivos del repo: solo el texto
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<i>\1</i>', t)
    t = re.sub(r'`([^`]+)`', r'<font face="Courier">\1</font>', t)
    return t


def tabla(filas):
    celdas = [[c.strip() for c in f.strip().strip('|').split('|')] for f in filas]
    celdas = [f for f in celdas if not all(re.fullmatch(r':?-{3,}:?', c) for c in f)]
    datos = [[Paragraph(en_linea(c), E['cabecera'] if i == 0 else E['celda']) for c in f] for i, f in enumerate(celdas)]
    ancho = A4[0] - 40 * mm
    n = len(celdas[0])
    largos = [max(len(f[i]) if i < len(f) else 0 for f in celdas) for i in range(n)]
    total = sum(largos) or 1
    anchos = [max(ancho * l / total, 22 * mm) for l in largos]
    escala = ancho / sum(anchos)
    t = Table(datos, colWidths=[a * escala for a in anchos], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), OSCURO),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, FONDO]),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return [t, Spacer(1, 8)]


def lista(items, numerada):
    elementos = [ListItem(Paragraph(en_linea(i), E['p']), leftIndent=14) for i in items]
    return [ListFlowable(elementos, bulletType='1' if numerada else 'bullet', start='1' if numerada else None,
                         bulletColor=ROJO, bulletFontSize=9, leftIndent=14)]


def nota(texto):
    t = Table([[Paragraph(en_linea(texto), E['nota'])]], colWidths=[A4[0] - 40 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), FONDO), ('LINEBEFORE', (0, 0), (0, -1), 3, ROJO),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return [t, Spacer(1, 8)]


def convertir(md):
    lineas = md.splitlines()
    salida = []
    i = 0
    omitiendo = None  # nivel del título que se está salteando

    while i < len(lineas):
        l = lineas[i]
        titulo = re.match(r'^(#{1,3})\s+(.*)', l)
        if titulo:
            nivel = len(titulo.group(1))
            if omitiendo and nivel <= omitiendo:
                omitiendo = None
            if any(o in titulo.group(2) for o in OMITIR):
                omitiendo = nivel
            if not omitiendo and nivel > 1:  # el título 1 va en la portada
                salida.append(Paragraph(en_linea(titulo.group(2)), E[f'h{nivel}']))
            i += 1
            continue
        if omitiendo or not l.strip() or re.fullmatch(r'-{3,}', l.strip()):
            i += 1
            continue
        if l.startswith('|'):
            filas = []
            while i < len(lineas) and lineas[i].startswith('|'):
                filas.append(lineas[i])
                i += 1
            salida += tabla(filas)
            continue
        if l.startswith('>'):
            bloque = []
            while i < len(lineas) and lineas[i].startswith('>'):
                bloque.append(lineas[i].lstrip('> ').strip())
                i += 1
            salida += nota(' '.join(bloque))
            continue
        marca = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', l)
        if marca:
            numerada = marca.group(2)[0].isdigit()
            items = []
            while i < len(lineas):
                m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', lineas[i])
                if m and (m.group(2)[0].isdigit()) == numerada:
                    items.append(m.group(3))
                elif lineas[i].startswith('  ') and lineas[i].strip() and items:
                    items[-1] += ' ' + lineas[i].strip()  # continuación del ítem
                else:
                    break
                i += 1
            salida += lista(items, numerada)
            continue
        parrafo = [l.strip()]
        i += 1
        while i < len(lineas) and lineas[i].strip() and not re.match(r'^(#|\||>|\s*([-*]|\d+\.)\s)', lineas[i]):
            parrafo.append(lineas[i].strip())
            i += 1
        salida.append(Paragraph(en_linea(' '.join(parrafo)), E['p']))
    while salida and isinstance(salida[-1], Spacer):  # un espacio al final abriría una página en blanco
        salida.pop()
    return salida


def pie(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(ROJO)
    canvas.setLineWidth(2)
    canvas.line(20 * mm, A4[1] - 14 * mm, A4[0] - 20 * mm, A4[1] - 14 * mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(GRIS)
    canvas.drawString(20 * mm, 10 * mm, 'BurgosCorp ERP · Manual de usuario')
    canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f'Página {doc.page}')
    canvas.restoreState()


def portada(canvas, doc):
    canvas.saveState()
    # Escudo "BC" como en la app.
    cx, cy = A4[0] / 2, A4[1] - 95 * mm
    canvas.setFillColor(ROJO)
    p = canvas.beginPath()
    p.moveTo(cx - 22 * mm, cy + 26 * mm)
    p.lineTo(cx + 22 * mm, cy + 26 * mm)
    p.lineTo(cx + 22 * mm, cy)
    p.curveTo(cx + 22 * mm, cy - 16 * mm, cx + 6 * mm, cy - 24 * mm, cx, cy - 28 * mm)
    p.curveTo(cx - 6 * mm, cy - 24 * mm, cx - 22 * mm, cy - 16 * mm, cx - 22 * mm, cy)
    p.close()
    canvas.drawPath(p, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 30)
    canvas.drawCentredString(cx, cy - 2 * mm, 'BC')
    canvas.restoreState()


def main():
    md = ORIGEN.read_text(encoding='utf-8')
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(DESTINO), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=18 * mm,
                            title='Manual de usuario · BurgosCorp ERP', author='BurgosCorp S.A.')
    contenido = [
        Spacer(1, 120 * mm),
        Paragraph('Manual de usuario', E['portada']), Spacer(1, 6),
        Paragraph('BurgosCorp ERP', E['subportada']), Spacer(1, 30),
        Paragraph('Cómo usar el sistema desde el celular o el navegador', E['subportada']), Spacer(1, 6),
        Paragraph(f'Versión del {date.today().strftime("%d/%m/%Y")}', E['subportada']),
        PageBreak(),
    ] + convertir(md)
    doc.build(contenido, onFirstPage=portada, onLaterPages=pie)
    print(f'PDF generado: {DESTINO.relative_to(RAIZ)} ({DESTINO.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    sys.exit(main())

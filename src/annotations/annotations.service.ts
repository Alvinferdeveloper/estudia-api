import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import ankiExport from 'anki-apkg-export';
import { Annotation } from '../typeorm/entities/Annotation.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { cleanMarkdownText } from '../common/utils/clean-text.util';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationRepository: Repository<Annotation>,
  ) { }

  async findByDocument(documentId: string, userId: string): Promise<Annotation[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.annotationRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
  }

  async findByPage(
    documentId: string,
    pageNumber: number,
    userId: string,
  ): Promise<Annotation[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.annotationRepository.find({
      where: { documentId, pageNumber },
    });
  }

  async create(data: {
    selectedText: string;
    comment?: string | null;
    aiResponse?: string | null;
    color: string;
    pageNumber: number;
    boundingRect: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
      pageNumber: number;
    };
    rects?: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
      pageNumber: number;
    }[];
    documentId: string;
    userId: string;
    embedding?: string | null;
  }): Promise<Annotation> {
    await this.verifyDocumentAccess(data.documentId, data.userId);
    const annotation = this.annotationRepository.create({
      selectedText: data.selectedText,
      comment: data.comment || null,
      aiResponse: data.aiResponse || null,
      color: data.color,
      pageNumber: data.pageNumber,
      boundingRect: data.boundingRect,
      rects: data.rects || [],
      documentId: data.documentId,
      embedding: data.embedding || null,
    });
    return this.annotationRepository.save(annotation);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      comment: string | null;
      aiResponse: string | null;
      color: string;
      boundingRect: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      };
      rects: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      }[];
    }>,
  ): Promise<Annotation | null> {
    const annotation = await this.annotationRepository.findOneBy({ id });
    if (!annotation) {
      return null;
    }
    await this.verifyDocumentAccess(annotation.documentId, userId);
    await this.annotationRepository.update(id, data);
    return this.annotationRepository.findOneBy({ id });
  }

  async delete(id: string, userId: string): Promise<void> {
    const annotation = await this.annotationRepository.findOneBy({ id });
    if (!annotation) {
      return;
    }
    await this.verifyDocumentAccess(annotation.documentId, userId);
    await this.annotationRepository.delete(id);
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.annotationRepository.manager.findOne(Document, {
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new UnauthorizedException('Access to this document is denied');
    }
  }

  async getDocument(documentId: string, userId: string): Promise<Document | null> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.annotationRepository.manager.findOne(Document, {
      where: { id: documentId, userId },
    });
  }

  async exportAnnotations(
    annotations: Annotation[],
    document: Document | null,
    format: 'markdown' | 'json' | 'csv' | 'pdf' | 'anki',
  ): Promise<{ content: string; contentType: string; fileName: string }> {
    const fileName = document?.fileName || 'document';

    switch (format) {
      case 'anki':
        const ankiBuffer = await this.generateAnkiDeck(annotations, document);
        return {
          content: ankiBuffer.toString('base64'),
          contentType: 'application/apkg',
          fileName: `${fileName}-flashcards.apkg`,
        };

      case 'json':
        const cleanAnnotations = annotations.map(a => ({
          ...a,
          aiResponse: cleanMarkdownText(a.aiResponse),
          comment: a.comment ? cleanMarkdownText(a.comment) : null,
        }));
        return {
          content: JSON.stringify(cleanAnnotations, null, 2),
          contentType: 'application/json',
          fileName: `${fileName}-notes.json`,
        };

      case 'csv':
        const escapeCsv = (str: string | null) => `"${(str || '').replace(/"/g, '""')}"`;
        const csvHeader = 'Page,Selected Text,Comment,AI Response,Color,Created At\n';
        const csvRows = annotations.map(a => {
          return `${a.pageNumber},${escapeCsv(a.selectedText)},${escapeCsv(cleanMarkdownText(a.comment))},${escapeCsv(cleanMarkdownText(a.aiResponse))},${escapeCsv(a.color)},${a.createdAt}`;
        }).join('\n');
        return {
          content: csvHeader + csvRows,
          contentType: 'text/csv',
          fileName: `${fileName}-notes.csv`,
        };

      case 'pdf':
        const pdfBuffer = await this.generatePdf(annotations, document);
        return {
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
          fileName: `${fileName}-notes.pdf`,
        };

      case 'markdown':
      default:
        const md = this.generateMarkdown(annotations, document);
        return {
          content: md,
          contentType: 'text/markdown',
          fileName: `${fileName}-notes.md`,
        };
    }
  }

  private generatePdf(annotations: Annotation[], document: Document | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        const doc = new PDFDocument({
          margin: 70,
          size: 'A4',
          bufferPages: true,
          info: {
            Title: `Notes: ${document?.fileName || 'Document'}`,
            Author: 'studiIA',
          },
        });

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const marginX = 70;
        const contentWidth = doc.page.width - marginX * 2;
        const textWidth = contentWidth - 30;

        const SPACING = {
          xs: 4,
          sm: 8,
          md: 12,
          lg: 20,
          xl: 30,
        };

        // --- Front Page ---
        doc
          .fontSize(30)
          .fillColor('#111827')
          .text('Study Notes', { align: 'center' });

        doc.moveDown(0.5);

        doc
          .fontSize(18)
          .fillColor('#6366F1')
          .text(document?.fileName || 'Document', { align: 'center' });

        doc.moveDown(1);

        doc
          .fontSize(12)
          .fillColor('#6B7280')
          .text(
            new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            { align: 'center' }
          );

        doc.moveDown(0.5);

        doc
          .fontSize(10)
          .fillColor('#9CA3AF')
          .text(`Total Notes: ${annotations.length}`, { align: 'center' });

        if (annotations.length === 0) {
          doc.moveDown(3);
          doc
            .fontSize(14)
            .fillColor('#9CA3AF')
            .text('No notes available for this document.', { align: 'center' });
          doc.end();
          return;
        }

        doc.addPage();

        // --- Grouped by Page ---
        const groupedByPage = annotations.reduce((acc, a) => {
          if (!acc[a.pageNumber]) acc[a.pageNumber] = [];
          acc[a.pageNumber].push(a);
          return acc;
        }, {} as Record<number, Annotation[]>);

        let noteIndex = 1;

        for (const pageNum of Object.keys(groupedByPage).sort((a, b) => Number(a) - Number(b))) {

          // --- Page Header ---
          doc
            .fontSize(13)
            .fillColor('#111827')
            .text(`Page ${pageNum}`, marginX, doc.y);

          doc
            .moveTo(marginX, doc.y + 5)
            .lineTo(marginX + contentWidth, doc.y + 5)
            .stroke('#E5E7EB');

          doc.moveDown(1.5);

          for (const note of groupedByPage[Number(pageNum)]) {

            // Basic page break
            if (doc.y > doc.page.height - 120) doc.addPage();

            // --- Note Title ---
            doc
              .fontSize(10)
              .fillColor('#6366F1')
              .text(`Note ${noteIndex++}`, marginX);

            doc.moveDown(0.5);

            // --- SELECTED TEXT ---
            doc
              .fontSize(9)
              .fillColor('#9CA3AF')
              .text('SELECTED TEXT', marginX);

            doc.moveDown(0.3);

            doc.fontSize(11);
            const selectedTextHeight = doc.heightOfString(note.selectedText, {
              width: textWidth,
              lineGap: 3,
            });

            if (doc.y + selectedTextHeight > doc.page.height - 100) {
              doc.addPage();
            }

            const yStart = doc.y;

            // Quote-style side line
            doc
              .rect(marginX, yStart, 3, selectedTextHeight + 10)
              .fill('#6366F1');

            doc
              .fontSize(11)
              .fillColor('#111827')
              .text(note.selectedText, marginX + 10, yStart + 5, {
                width: textWidth,
                lineGap: 3,
              });

            doc.moveDown(1.5);

            // --- COMMENT ---
            if (note.comment) {
              doc
                .fontSize(9)
                .fillColor('#9CA3AF')
                .text('COMMENT', marginX);

              doc.moveDown(0.3);

              doc
                .fontSize(11)
                .fillColor('#374151')
                .text(note.comment, {
                  width: contentWidth,
                  lineGap: 3,
                });

              doc.moveDown(1.5);
            }

            // --- AI RESPONSE ---
            if (note.aiResponse) {
              const clean = cleanMarkdownText(note.aiResponse);

              doc.fontSize(10);
              const aiTextHeight = doc.heightOfString(clean, {
                width: textWidth,
                lineGap: 3,
              });

              if (doc.y + aiTextHeight > doc.page.height - 100) {
                doc.addPage();
              }

              const boxY = doc.y;

              doc
                .rect(marginX, boxY, contentWidth, aiTextHeight + 25)
                .fill('#EEF2FF')
                .stroke('#C7D2FE');

              doc
                .fontSize(9)
                .fillColor('#6366F1')
                .text('AI EXPLANATION', marginX + 10, boxY + 8);

              doc
                .fontSize(10)
                .fillColor('#3730A3')
                .text(clean, marginX + 10, boxY + 22, {
                  width: textWidth,
                  lineGap: 3,
                });

              doc.moveDown(2);
            }

            // --- Separator ---
            doc
              .moveTo(marginX, doc.y)
              .lineTo(marginX + contentWidth, doc.y)
              .stroke('#F3F4F6');

            doc.moveDown(2);
          }
        }

        // --- FOOTER ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);

          doc
            .fontSize(8)
            .fillColor('#9CA3AF')
            .text(
              `Generated by studiIA • Page ${i + 1}`,
              marginX,
              doc.page.height - 40,
              {
                align: 'center',
                width: contentWidth,
              }
            );
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
  private generateMarkdown(annotations: Annotation[], document: Document | null): string {
    const lines: string[] = [];

    lines.push(`# Notes: ${document?.fileName || 'Document'}\n`);
    lines.push(`*Exported on ${new Date().toLocaleDateString()}*\n`);
    lines.push('---\n');

    if (annotations.length === 0) {
      lines.push('*No notes available*');
      return lines.join('\n');
    }

    const groupedByPage = annotations.reduce((acc, a) => {
      if (!acc[a.pageNumber]) {
        acc[a.pageNumber] = [];
      }
      acc[a.pageNumber].push(a);
      return acc;
    }, {} as Record<number, Annotation[]>);

    for (const pageNum of Object.keys(groupedByPage).sort((a, b) => Number(a) - Number(b))) {
      lines.push(`## Page ${pageNum}\n`);

      for (const note of groupedByPage[Number(pageNum)]) {
        lines.push(`### ${note.color} Highlight\n`);
        lines.push(`> ${note.selectedText}\n`);

        if (note.comment) {
          lines.push(`**Comment:** ${note.comment}\n`);
        }

        if (note.aiResponse) {
          lines.push(`**AI Explanation:**\n${note.aiResponse}\n`);
        }

        lines.push('---\n');
      }
    }

    return lines.join('\n');
  }

  private async generateAnkiDeck(annotations: Annotation[], document: Document | null) {
    const deckName = document?.fileName
      ? `studiIA - ${document.fileName.replace(/\.pdf$/i, '')}`
      : 'studiIA - Notes';

    const deck = new ankiExport(deckName);

    const annotationsWithAi = annotations.filter(a => a.aiResponse);

    if (annotationsWithAi.length === 0) {
      deck.addCard(
        'No AI notes available',
        'Add notes with AI explanations to generate flashcards'
      );
    } else {
      for (const note of annotationsWithAi) {
        const front = cleanMarkdownText(note.selectedText).substring(0, 500);
        const back = cleanMarkdownText(note.aiResponse).substring(0, 1000);

        deck.addCard(front, back);
      }
    }

    const zip = await deck.save();

    return Buffer.from(zip);
  }
}

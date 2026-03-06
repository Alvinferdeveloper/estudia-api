import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { AnnotationsService } from './annotations.service';

@Controller()
export class AnnotationsController {
    constructor(private readonly annotationsService: AnnotationsService) { }

    @Get('documents/:documentId/annotations')
    async findByDocument(@Param('documentId', ParseUUIDPipe) documentId: string) {
        return this.annotationsService.findByDocument(documentId);
    }

    @Get('documents/:documentId/annotations/page/:pageNumber')
    async findByPage(
        @Param('documentId', ParseUUIDPipe) documentId: string,
        @Param('pageNumber') pageNumber: number,
    ) {
        return this.annotationsService.findByPage(documentId, pageNumber);
    }

    @Post('documents/:documentId/annotations')
    async create(
        @Param('documentId', ParseUUIDPipe) documentId: string,
        @Body() createAnnotationDto: {
            selectedText: string;
            comment?: string;
            aiResponse?: string;
            color: string;
            pageNumber: number;
            boundingRect: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number };
            rects?: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number }[];
            embedding?: string;
        },
    ) {
        return this.annotationsService.create({
            ...createAnnotationDto,
            documentId,
        });
    }

    @Patch('annotations/:id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateAnnotationDto: {
            comment?: string;
            aiResponse?: string;
            color?: string;
            boundingRect?: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number };
            rects?: { x1: number; y1: number; x2: number; y2: number; width: number; height: number; pageNumber: number }[];
        },
    ) {
        return this.annotationsService.update(id, updateAnnotationDto);
    }

    @Delete('annotations/:id')
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        await this.annotationsService.delete(id);
        return { success: true };
    }
}

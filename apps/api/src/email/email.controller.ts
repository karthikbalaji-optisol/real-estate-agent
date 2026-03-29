import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { EmailService } from './email.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { EmailResponseDto } from './dto/email-response.dto';

@ApiTags('Emails')
@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @ApiOperation({ summary: 'Add a monitored email account (password-based)' })
  @ApiCreatedResponse({ type: EmailResponseDto })
  create(@Body() dto: CreateEmailDto): Promise<EmailResponseDto> {
    return this.emailService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all monitored emails with masked passwords' })
  @ApiOkResponse({ type: [EmailResponseDto] })
  findAll(): Promise<EmailResponseDto[]> {
    return this.emailService.findAll();
  }

  // ────────── Outlook OAuth ──────────

  @Get('outlook/auth')
  @ApiOperation({ summary: 'Redirect to Microsoft OAuth consent page' })
  outlookAuth(@Res() res: Response): void {
    try {
      const url = this.emailService.getOutlookAuthUrl();
      res.redirect(url);
    } catch (err: any) {
      res.redirect('/emails?oauth_error=' + encodeURIComponent(err.message || 'OAuth not configured'));
    }
  }

  @Get('outlook/callback')
  @ApiOperation({ summary: 'Handle Microsoft OAuth callback' })
  async outlookCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    if (error || !code) {
      // Redirect back to frontend with error
      res.redirect('/emails?oauth_error=' + encodeURIComponent(error || 'no_code'));
      return;
    }

    try {
      await this.emailService.handleOutlookCallback(code);
      // Redirect back to frontend email manager on success
      res.redirect('/emails?oauth_success=true');
    } catch (err: any) {
      res.redirect('/emails?oauth_error=' + encodeURIComponent(err.message || 'unknown'));
    }
  }

  // ────────── Standard CRUD ──────────

  @Patch(':id')
  @ApiOperation({ summary: 'Toggle email enabled/disabled' })
  @ApiOkResponse({ type: EmailResponseDto })
  @ApiNotFoundResponse({ description: 'Email not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailDto,
  ): Promise<EmailResponseDto> {
    return this.emailService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a monitored email' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Email not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.emailService.remove(id);
  }
}

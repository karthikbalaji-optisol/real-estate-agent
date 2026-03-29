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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EmailService } from './email.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { EmailResponseDto } from './dto/email-response.dto';

@ApiTags('Emails')
@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @ApiOperation({ summary: 'Add a monitored email account' })
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

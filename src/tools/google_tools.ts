import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolDependencies } from './base.js';

const execAsync = promisify(exec);

interface CalendarEventsParams {
  calendarId?: string;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}

interface CalendarCreateParams {
  summary: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees?: string[];
  calendarId?: string;
}

interface CalendarUpdateParams {
  eventId: string;
  calendarId?: string;
  summary?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
}

interface GmailSearchParams {
  query: string;
  maxResults?: number;
}

interface GmailSendParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

interface GmailDraftsParams {
  maxResults?: number;
}

interface DriveSearchParams {
  query: string;
  maxResults?: number;
}

interface ContactsListParams {
  maxResults?: number;
}

interface SheetsGetParams {
  spreadsheetId: string;
  range?: string;
}

interface SheetsUpdateParams {
  spreadsheetId: string;
  range: string;
  values: string[][];
}

interface SheetsAppendParams {
  spreadsheetId: string;
  range: string;
  values: string[][];
}

interface DocsCatParams {
  documentId: string;
}

interface DocsExportParams {
  documentId: string;
  format: 'pdf' | 'docx' | 'txt';
}

export default class GoogleWorkspaceTool implements Tool {
  name = 'google_workspace';
  description = `Gestión de calendario, email y archivos de Google Workspace. Usa gogcli internamente.`;

  schema = z.object({
    action: z.enum([
      'calendar events', 'calendar create', 'calendar update',
      'gmail search', 'gmail send', 'gmail drafts',
      'drive search', 'contacts list',
      'sheets get', 'sheets update', 'sheets append',
      'docs cat', 'docs export'
    ]).describe('Acción a realizar en Google Workspace'),
    calendarId: z.string().optional().default('primary'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    maxResults: z.number().optional().default(10),
    summary: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string()).optional(),
    eventId: z.string().optional(),
    query: z.string().optional(),
    to: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    cc: z.string().optional(),
    spreadsheetId: z.string().optional(),
    range: z.string().optional(),
    values: z.array(z.array(z.string())).optional(),
    documentId: z.string().optional(),
    format: z.enum(['pdf', 'docx', 'txt']).optional(),
  });

  constructor(_deps: ToolDependencies) {}

  private escapeShellValue(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private buildCalendarEventsCommand(params: CalendarEventsParams): string {
    const parts = ['gog', 'calendar', 'events'];
    parts.push(this.escapeShellValue(params.calendarId || 'primary'));
    
    if (params.startDate) parts.push(`--from=${this.escapeShellValue(params.startDate)}`);
    if (params.endDate) parts.push(`--to=${this.escapeShellValue(params.endDate)}`);
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildCalendarCreateCommand(params: CalendarCreateParams): string {
    const parts = ['gog', 'calendar', 'create'];
    parts.push(this.escapeShellValue(params.calendarId || 'primary'));
    
    parts.push(`--summary=${this.escapeShellValue(params.summary)}`);
    parts.push(`--from=${this.escapeShellValue(params.startTime)}`);
    parts.push(`--to=${this.escapeShellValue(params.endTime)}`);
    
    if (params.description) parts.push(`--description=${this.escapeShellValue(params.description)}`);
    if (params.location) parts.push(`--location=${this.escapeShellValue(params.location)}`);
    if (params.attendees?.length) {
      parts.push(`--attendees=${this.escapeShellValue(params.attendees.join(','))}`);
    }
    return parts.join(' ');
  }

  private buildCalendarUpdateCommand(params: CalendarUpdateParams): string {
    const parts = ['gog', 'calendar', 'update'];
    parts.push(this.escapeShellValue(params.calendarId || 'primary'));
    parts.push(this.escapeShellValue(params.eventId));
    
    if (params.summary) parts.push(`--summary=${this.escapeShellValue(params.summary)}`);
    if (params.startTime) parts.push(`--from=${this.escapeShellValue(params.startTime)}`);
    if (params.endTime) parts.push(`--to=${this.escapeShellValue(params.endTime)}`);
    if (params.description) parts.push(`--description=${this.escapeShellValue(params.description)}`);
    if (params.location) parts.push(`--location=${this.escapeShellValue(params.location)}`);
    return parts.join(' ');
  }

  private buildGmailSearchCommand(params: GmailSearchParams): string {
    const parts = ['gog', 'gmail', 'search'];
    parts.push(this.escapeShellValue(params.query));
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildGmailSendCommand(params: GmailSendParams): string {
    const parts = ['gog', 'gmail', 'send'];
    parts.push(`--to=${this.escapeShellValue(params.to)}`);
    parts.push(`--subject=${this.escapeShellValue(params.subject)}`);
    parts.push(`--body=${this.escapeShellValue(params.body)}`);
    if (params.cc) parts.push(`--cc=${this.escapeShellValue(params.cc)}`);
    return parts.join(' ');
  }

  private buildGmailDraftsCommand(params: GmailDraftsParams): string {
    const parts = ['gog', 'gmail', 'drafts'];
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildDriveSearchCommand(params: DriveSearchParams): string {
    const parts = ['gog', 'drive', 'search'];
    parts.push(this.escapeShellValue(params.query));
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildContactsListCommand(params: ContactsListParams): string {
    const parts = ['gog', 'contacts', 'list'];
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildSheetsGetCommand(params: SheetsGetParams): string {
    const parts = ['gog', 'sheets', 'get'];
    parts.push(this.escapeShellValue(params.spreadsheetId));
    parts.push(this.escapeShellValue(params.range || 'A1:Z100'));
    parts.push('--json');
    return parts.join(' ');
  }

  private buildSheetsUpdateCommand(params: SheetsUpdateParams): string {
    const parts = ['gog', 'sheets', 'update'];
    parts.push(this.escapeShellValue(params.spreadsheetId));
    parts.push(this.escapeShellValue(params.range));
    parts.push(`--values-json=${this.escapeShellValue(JSON.stringify(params.values))}`);
    parts.push('--input=USER_ENTERED');
    return parts.join(' ');
  }

  private buildSheetsAppendCommand(params: SheetsAppendParams): string {
    const parts = ['gog', 'sheets', 'append'];
    parts.push(this.escapeShellValue(params.spreadsheetId));
    parts.push(this.escapeShellValue(params.range));
    parts.push(`--values-json=${this.escapeShellValue(JSON.stringify(params.values))}`);
    parts.push('--input=USER_ENTERED');
    return parts.join(' ');
  }

  private buildDocsCatCommand(params: DocsCatParams): string {
    const parts = ['gog', 'docs', 'cat'];
    parts.push(this.escapeShellValue(params.documentId));
    return parts.join(' ');
  }

  private buildDocsExportCommand(params: DocsExportParams): string {
    const parts = ['gog', 'docs', 'export'];
    parts.push(this.escapeShellValue(params.documentId));
    parts.push(`--format=${this.escapeShellValue(params.format)}`);
    return parts.join(' ');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string' as const,
            description: 'Acción a realizar en Google Workspace (USA el enum completo, ej: "calendar create", NO "create" ni "calendar")',
            enum: [
              'calendar events',
              'calendar create',
              'calendar update',
              'gmail search',
              'gmail send',
              'gmail drafts',
              'drive search',
              'contacts list',
              'sheets get',
              'sheets update',
              'sheets append',
              'docs cat',
              'docs export'
            ]
          },
          calendarId: {
            type: 'string' as const,
            description: 'ID del calendario de Google (opcional, usa "primary" por defecto)'
          },
          startDate: {
            type: 'string' as const,
            description: 'Fecha de INICIO para filtrar eventos del calendario. NO uses timeMin ni --start. Formato: fecha simple (2024-03-20), RFC3339 (2024-03-20T00:00:00), o relativa (today, tomorrow, monday). EJEMPLOS: "2024-03-20", "today", "tomorrow"'
          },
          endDate: {
            type: 'string' as const,
            description: 'Fecha de FIN para filtrar eventos del calendario. NO uses timeMax ni --end. Formato: fecha simple (2024-03-20), RFC3339 (2024-03-20T23:59:59), o relativa (today, tomorrow, monday). EJEMPLOS: "2024-03-20", "today", "tomorrow"'
          },
          maxResults: {
            type: 'number' as const,
            description: 'Número máximo de resultados a devolver (default: 10)'
          },
          summary: {
            type: 'string' as const,
            description: 'Título/resumen del evento de calendario. Este es el NOMBRE del evento, no flags de gogcli.'
          },
          startTime: {
            type: 'string' as const,
            description: 'Hora de inicio del evento. Formato ISO 8601: "2024-03-20T20:00:00"'
          },
          endTime: {
            type: 'string' as const,
            description: 'Hora de fin del evento. Formato ISO 8601: "2024-03-20T22:00:00"'
          },
          description: {
            type: 'string' as const,
            description: 'Descripción del evento de calendario o email'
          },
          location: {
            type: 'string' as const,
            description: 'Ubicación/lugar del evento de calendario'
          },
          attendees: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Lista de emails de asistentes al evento'
          },
          eventId: {
            type: 'string' as const,
            description: 'ID del evento de calendario a actualizar'
          },
          query: {
            type: 'string' as const,
            description: 'Texto de búsqueda para Gmail o Drive. NO uses flags como --query, solo el texto de búsqueda (ej: "from:roberto@gmail.com subject:reunión")'
          },
          to: {
            type: 'string' as const,
            description: 'Email del destinatario para gmail send'
          },
          subject: {
            type: 'string' as const,
            description: 'Asunto del email para gmail send'
          },
          body: {
            type: 'string' as const,
            description: 'Cuerpo del mensaje para gmail send'
          },
          cc: {
            type: 'string' as const,
            description: 'Emails en copia para gmail send (separados por coma)'
          },
          spreadsheetId: {
            type: 'string' as const,
            description: 'ID del spreadsheet de Google Sheets'
          },
          range: {
            type: 'string' as const,
            description: 'Rango de celdas en Sheets (ej: "Sheet1!A1:B10")'
          },
          values: {
            type: 'array' as const,
            items: { type: 'array' as const, items: { type: 'string' as const } },
            description: 'Datos a escribir en Sheets como array de arrays (ej: [["nombre","edad"],["Pablo","30"]])'
          },
          documentId: {
            type: 'string' as const,
            description: 'ID del documento de Google Docs'
          },
          format: {
            type: 'string' as const,
            description: 'Formato de exportación para docs',
            enum: ['pdf', 'docx', 'txt']
          }
        },
        required: ['action'] as string[]
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const validated = this.schema.parse(params);
    const action = validated.action;

    let command: string;

    switch (action) {
      case 'calendar events':
        command = this.buildCalendarEventsCommand(validated);
        break;

      case 'calendar create':
        if (!validated.summary || !validated.startTime || !validated.endTime) {
          throw new Error('calendar create requiere: summary, startTime, endTime');
        }
        command = this.buildCalendarCreateCommand(validated as CalendarCreateParams);
        break;

      case 'calendar update':
        if (!validated.eventId) {
          throw new Error('calendar update requiere: eventId');
        }
        command = this.buildCalendarUpdateCommand(validated as CalendarUpdateParams);
        break;

      case 'gmail search':
        if (!validated.query) {
          throw new Error('gmail search requiere: query');
        }
        command = this.buildGmailSearchCommand(validated as GmailSearchParams);
        break;

      case 'gmail send':
        if (!validated.to || !validated.subject || !validated.body) {
          throw new Error('gmail send requiere: to, subject, body');
        }
        command = this.buildGmailSendCommand(validated as GmailSendParams);
        break;

      case 'gmail drafts':
        command = this.buildGmailDraftsCommand(validated);
        break;

      case 'drive search':
        if (!validated.query) {
          throw new Error('drive search requiere: query');
        }
        command = this.buildDriveSearchCommand(validated as DriveSearchParams);
        break;

      case 'contacts list':
        command = this.buildContactsListCommand(validated);
        break;

      case 'sheets get':
        if (!validated.spreadsheetId) {
          throw new Error('sheets get requiere: spreadsheetId');
        }
        command = this.buildSheetsGetCommand(validated as SheetsGetParams);
        break;

      case 'sheets update':
        if (!validated.spreadsheetId || !validated.range || !validated.values) {
          throw new Error('sheets update requiere: spreadsheetId, range, values');
        }
        command = this.buildSheetsUpdateCommand(validated as SheetsUpdateParams);
        break;

      case 'sheets append':
        if (!validated.spreadsheetId || !validated.range || !validated.values) {
          throw new Error('sheets append requiere: spreadsheetId, range, values');
        }
        command = this.buildSheetsAppendCommand(validated as SheetsAppendParams);
        break;

      case 'docs cat':
        if (!validated.documentId) {
          throw new Error('docs cat requiere: documentId');
        }
        command = this.buildDocsCatCommand(validated as DocsCatParams);
        break;

      case 'docs export':
        if (!validated.documentId || !validated.format) {
          throw new Error('docs export requiere: documentId, format');
        }
        command = this.buildDocsExportCommand(validated as DocsExportParams);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const isEmptyResult = (output: string): boolean => {
      const normalized = (output || '').trim().toLowerCase();
      return normalized === 'no events' ||
             normalized === 'no results' ||
             normalized.startsWith('no events\n') ||
             normalized.startsWith('no results\n') ||
             normalized.includes('no events found') ||
             normalized.includes('no results found');
    };

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      const combined = stdout + (stderr ? '\n' + stderr : '');

      if (isEmptyResult(combined)) {
        return JSON.stringify({
          success: true,
          output: combined.trim(),
          note: 'Empty result from gogcli'
        });
      }

      if (stderr && !stdout) {
        return JSON.stringify({ success: false, error: stderr });
      }

      return JSON.stringify({
        success: true,
        output: stdout || '(sin salida)',
        stderr: stderr || null
      });
    } catch (error) {
      const err = error as any;
      const errOutput = (err.stdout || '') + '\n' + (err.stderr || '');

      if (isEmptyResult(errOutput)) {
        return JSON.stringify({
          success: true,
          output: errOutput.trim(),
          note: 'Empty result from gogcli (caught as exception)'
        });
      }

      return JSON.stringify({
        success: false,
        error: err.message,
        stdout: err.stdout,
        stderr: err.stderr
      });
    }
  }
}

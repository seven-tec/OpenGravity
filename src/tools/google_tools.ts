import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool } from './base.js';

const execAsync = promisify(exec);

interface CalendarEventsParams {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
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

export class GoogleWorkspaceTool implements Tool {
  name = 'google_workspace';
  description = `Gestión de calendario, email y archivos de Google Workspace (Google Calendar, Gmail, Drive, Sheets, Docs, Contacts).

USA ESTA HERRAMIENTA PARA:
- Crear/leer eventos en Google Calendar (actions: calendar events, calendar create, calendar update)
- Buscar/enviar emails de Gmail (actions: gmail search, gmail send, gmail drafts)
- Buscar archivos en Google Drive (action: drive search)
- Listar contactos de Google Contacts (action: contacts list)
- Leer/actualizar spreadsheets de Google Sheets (actions: sheets get, sheets update, sheets append)
- Leer/exportar documentos de Google Docs (actions: docs cat, docs export)

NO USES ESTA HERRAMIENTA PARA:
- Guardar información personal, recuerdos o datos de largo plazo del usuario
- Clasificar notas o aprendizajes
- Para eso, usa 'manage_personal_knowledge'

PARAMETERS IMPORTANTES:
- action: Siempre usa el enum completo (ej: 'calendar create', NO 'create' ni 'calendar')
- startTime/endTime: Formato ISO 8601 (ej: "2024-03-20T20:00:00")
- summary: Título del evento de calendario
- query: Texto de búsqueda para gmail/drive (NO uses flags como --query, solo el texto)`;

  private escapeShellValue(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private buildCalendarEventsCommand(params: CalendarEventsParams): string {
    const parts = ['gog', 'calendar', 'events'];
    if (params.calendarId) parts.push(`--calendarId=${this.escapeShellValue(params.calendarId)}`);
    if (params.timeMin) parts.push(`--timeMin=${this.escapeShellValue(params.timeMin)}`);
    if (params.timeMax) parts.push(`--timeMax=${this.escapeShellValue(params.timeMax)}`);
    if (params.maxResults) parts.push(`--max=${params.maxResults}`);
    return parts.join(' ');
  }

  private buildCalendarCreateCommand(params: CalendarCreateParams): string {
    const parts = ['gog', 'calendar', 'create'];
    parts.push(`--summary=${this.escapeShellValue(params.summary)}`);
    parts.push(`--start=${this.escapeShellValue(params.startTime)}`);
    parts.push(`--end=${this.escapeShellValue(params.endTime)}`);
    if (params.description) parts.push(`--description=${this.escapeShellValue(params.description)}`);
    if (params.location) parts.push(`--location=${this.escapeShellValue(params.location)}`);
    if (params.attendees?.length) {
      parts.push(`--attendees=${this.escapeShellValue(params.attendees.join(','))}`);
    }
    if (params.calendarId) parts.push(`--calendarId=${this.escapeShellValue(params.calendarId)}`);
    return parts.join(' ');
  }

  private buildCalendarUpdateCommand(params: CalendarUpdateParams): string {
    const parts = ['gog', 'calendar', 'update'];
    parts.push(`--eventId=${this.escapeShellValue(params.eventId)}`);
    if (params.summary) parts.push(`--summary=${this.escapeShellValue(params.summary)}`);
    if (params.startTime) parts.push(`--start=${this.escapeShellValue(params.startTime)}`);
    if (params.endTime) parts.push(`--end=${this.escapeShellValue(params.endTime)}`);
    if (params.description) parts.push(`--description=${this.escapeShellValue(params.description)}`);
    if (params.location) parts.push(`--location=${this.escapeShellValue(params.location)}`);
    return parts.join(' ');
  }

  private buildGmailSearchCommand(params: GmailSearchParams): string {
    const parts = ['gog', 'gmail', 'search'];
    parts.push(`--query=${this.escapeShellValue(params.query)}`);
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
    parts.push(`--query=${this.escapeShellValue(params.query)}`);
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
    parts.push(`--id=${this.escapeShellValue(params.spreadsheetId)}`);
    if (params.range) parts.push(`--range=${this.escapeShellValue(params.range)}`);
    return parts.join(' ');
  }

  private buildSheetsUpdateCommand(params: SheetsUpdateParams): string {
    const parts = ['gog', 'sheets', 'update'];
    parts.push(`--id=${this.escapeShellValue(params.spreadsheetId)}`);
    parts.push(`--range=${this.escapeShellValue(params.range)}`);
    parts.push(`--values=${this.escapeShellValue(JSON.stringify(params.values))}`);
    return parts.join(' ');
  }

  private buildSheetsAppendCommand(params: SheetsAppendParams): string {
    const parts = ['gog', 'sheets', 'append'];
    parts.push(`--id=${this.escapeShellValue(params.spreadsheetId)}`);
    parts.push(`--range=${this.escapeShellValue(params.range)}`);
    parts.push(`--values=${this.escapeShellValue(JSON.stringify(params.values))}`);
    return parts.join(' ');
  }

  private buildDocsCatCommand(params: DocsCatParams): string {
    const parts = ['gog', 'docs', 'cat'];
    parts.push(`--id=${this.escapeShellValue(params.documentId)}`);
    return parts.join(' ');
  }

  private buildDocsExportCommand(params: DocsExportParams): string {
    const parts = ['gog', 'docs', 'export'];
    parts.push(`--id=${this.escapeShellValue(params.documentId)}`);
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
          timeMin: {
            type: 'string' as const,
            description: 'Fecha/hora de inicio para filtrar eventos. Formato ISO 8601: "2024-03-20T00:00:00"'
          },
          timeMax: {
            type: 'string' as const,
            description: 'Fecha/hora de fin para filtrar eventos. Formato ISO 8601: "2024-03-20T23:59:59"'
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
    const action = params.action as string;

    let command: string;

    switch (action) {
      case 'calendar events':
        command = this.buildCalendarEventsCommand({
          calendarId: params.calendarId as string | undefined,
          timeMin: params.timeMin as string | undefined,
          timeMax: params.timeMax as string | undefined,
          maxResults: params.maxResults as number | undefined
        });
        break;

      case 'calendar create':
        if (!params.summary || !params.startTime || !params.endTime) {
          return JSON.stringify({
            success: false,
            error: 'calendar create requiere: summary, startTime, endTime'
          });
        }
        command = this.buildCalendarCreateCommand({
          summary: params.summary as string,
          startTime: params.startTime as string,
          endTime: params.endTime as string,
          description: params.description as string | undefined,
          location: params.location as string | undefined,
          attendees: params.attendees as string[] | undefined,
          calendarId: params.calendarId as string | undefined
        });
        break;

      case 'calendar update':
        if (!params.eventId) {
          return JSON.stringify({
            success: false,
            error: 'calendar update requiere: eventId'
          });
        }
        command = this.buildCalendarUpdateCommand({
          eventId: params.eventId as string,
          summary: params.summary as string | undefined,
          startTime: params.startTime as string | undefined,
          endTime: params.endTime as string | undefined,
          description: params.description as string | undefined,
          location: params.location as string | undefined
        });
        break;

      case 'gmail search':
        if (!params.query) {
          return JSON.stringify({
            success: false,
            error: 'gmail search requiere: query'
          });
        }
        command = this.buildGmailSearchCommand({
          query: params.query as string,
          maxResults: params.maxResults as number | undefined
        });
        break;

      case 'gmail send':
        if (!params.to || !params.subject || !params.body) {
          return JSON.stringify({
            success: false,
            error: 'gmail send requiere: to, subject, body'
          });
        }
        command = this.buildGmailSendCommand({
          to: params.to as string,
          subject: params.subject as string,
          body: params.body as string,
          cc: params.cc as string | undefined
        });
        break;

      case 'gmail drafts':
        command = this.buildGmailDraftsCommand({
          maxResults: params.maxResults as number | undefined
        });
        break;

      case 'drive search':
        if (!params.query) {
          return JSON.stringify({
            success: false,
            error: 'drive search requiere: query'
          });
        }
        command = this.buildDriveSearchCommand({
          query: params.query as string,
          maxResults: params.maxResults as number | undefined
        });
        break;

      case 'contacts list':
        command = this.buildContactsListCommand({
          maxResults: params.maxResults as number | undefined
        });
        break;

      case 'sheets get':
        if (!params.spreadsheetId) {
          return JSON.stringify({
            success: false,
            error: 'sheets get requiere: spreadsheetId'
          });
        }
        command = this.buildSheetsGetCommand({
          spreadsheetId: params.spreadsheetId as string,
          range: params.range as string | undefined
        });
        break;

      case 'sheets update':
        if (!params.spreadsheetId || !params.range || !params.values) {
          return JSON.stringify({
            success: false,
            error: 'sheets update requiere: spreadsheetId, range, values'
          });
        }
        command = this.buildSheetsUpdateCommand({
          spreadsheetId: params.spreadsheetId as string,
          range: params.range as string,
          values: params.values as string[][]
        });
        break;

      case 'sheets append':
        if (!params.spreadsheetId || !params.range || !params.values) {
          return JSON.stringify({
            success: false,
            error: 'sheets append requiere: spreadsheetId, range, values'
          });
        }
        command = this.buildSheetsAppendCommand({
          spreadsheetId: params.spreadsheetId as string,
          range: params.range as string,
          values: params.values as string[][]
        });
        break;

      case 'docs cat':
        if (!params.documentId) {
          return JSON.stringify({
            success: false,
            error: 'docs cat requiere: documentId'
          });
        }
        command = this.buildDocsCatCommand({
          documentId: params.documentId as string
        });
        break;

      case 'docs export':
        if (!params.documentId || !params.format) {
          return JSON.stringify({
            success: false,
            error: 'docs export requiere: documentId, format'
          });
        }
        command = this.buildDocsExportCommand({
          documentId: params.documentId as string,
          format: params.format as 'pdf' | 'docx' | 'txt'
        });
        break;

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown action: ${action}. Usa el enum completo (ej: "calendar create", NO "create")`
        });
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

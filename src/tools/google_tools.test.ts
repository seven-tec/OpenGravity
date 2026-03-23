import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoogleWorkspaceTool from './google_tools.js';
import { exec } from 'child_process';

// Mock de child_process
vi.mock('child_process', () => ({
  exec: vi.fn((_cmd, options, cb) => {
    const callback = typeof options === 'function' ? options : cb;
    if (typeof callback === 'function') {
      // Simulate successful execution
      callback(null, { stdout: 'ok', stderr: '' });
    }
  })
}));

describe('GoogleWorkspaceTool', () => {
  let tool: GoogleWorkspaceTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GoogleWorkspaceTool({} as any);
  });

  describe('Command Generation', () => {
    it('should build correct calendar events command with defaults', async () => {
      await tool.execute({ action: 'calendar events' });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog calendar events "primary"'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should build correct calendar events command with params', async () => {
      await tool.execute({ 
        action: 'calendar events', 
        calendarId: 'test@gmail.com',
        startDate: '2024-03-20',
        maxResults: 5
      });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog calendar events "test@gmail.com" --from="2024-03-20" --max=5'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should build correct gmail search command', async () => {
      await tool.execute({ 
        action: 'gmail search', 
        query: 'from:boss' 
      });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog gmail search "from:boss"'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should build correct sheets get command with default range', async () => {
      await tool.execute({ 
        action: 'sheets get', 
        spreadsheetId: 'sheet123' 
      });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog sheets get "sheet123" "A1:Z100" --json'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should build correct sheets get command with custom range', async () => {
      await tool.execute({ 
        action: 'sheets get', 
        spreadsheetId: 'sheet123',
        range: 'Hoja1!A:B'
      });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog sheets get "sheet123" "Hoja1!A:B" --json'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should handle shell escaping correctly', async () => {
      await tool.execute({ 
        action: 'gmail search', 
        query: 'subject:"reunión importante"' 
      });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('gog gmail search "subject:\\"reunión importante\\""'),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error if required params are missing', async () => {
        // La validación de Zod debería atrapar esto antes de llegar a exec
        await expect(tool.execute({ action: 'calendar create' }))
            .rejects.toThrow();
    });
  });
});

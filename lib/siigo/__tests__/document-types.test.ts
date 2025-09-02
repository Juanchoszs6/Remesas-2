import { getDocumentTypes, getAllDocumentTypes } from '../document-types';

describe('Document Types', () => {
  const mockToken = 'test-token';
  const mockPartnerId = 'test-partner';

  // Mock fetch
  global.fetch = jest.fn() as jest.Mock;

  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  describe('getDocumentTypes', () => {
    it('should fetch document types successfully', async () => {
      const mockData = [{ id: 1, code: 'FC', name: 'Factura de Venta' }];
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await getDocumentTypes(mockToken, 'FC', mockPartnerId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=FC'),
        expect.any(Object)
      );
    });
  });

  describe('getAllDocumentTypes', () => {
    it('should fetch all document types', async () => {
      const mockResponses = [
        { ok: true, json: async () => [{ id: 1, type: 'FC' }] },
        { ok: true, json: async () => [{ id: 2, type: 'ND' }] },
        { ok: true, json: async () => [{ id: 3, type: 'DS' }] },
        { ok: true, json: async () => [{ id: 4, type: 'RP' }] },
      ];

      (fetch as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve(mockResponses[0]))
        .mockImplementationOnce(() => Promise.resolve(mockResponses[1]))
        .mockImplementationOnce(() => Promise.resolve(mockResponses[2]))
        .mockImplementationOnce(() => Promise.resolve(mockResponses[3]));

      const result = await getAllDocumentTypes(mockToken, mockPartnerId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(4);
      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });
});

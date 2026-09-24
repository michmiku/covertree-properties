import { describe, expect, it, vi } from 'vitest';
import { getPropertyService } from './get-property.service.ts';

const ID = '3f1c2a4e-9b7d-4c1e-8a2f-0d6b5e4c3a21';

describe('property id handling', () => {
  it.each(['not-a-uuid', '', `${ID}x`, '3f1c2a4e9b7d4c1e8a2f0d6b5e4c3a21'])(
    'S4.2 returns null for the malformed id %j without querying the repository',
    async (id) => {
      const findById = vi.fn();

      expect(await getPropertyService({ properties: { findById } })(id)).toBeNull();
      expect(findById).not.toHaveBeenCalled();
    },
  );

  it('S4.1 looks up a well-formed id', async () => {
    const findById = vi.fn().mockResolvedValue(null);

    await getPropertyService({ properties: { findById } })(ID.toUpperCase());

    expect(findById).toHaveBeenCalledWith(ID.toUpperCase());
  });
});

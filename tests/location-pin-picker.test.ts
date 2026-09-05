import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/maps/LocationPinPicker.tsx'),
  'utf8',
);

describe('Location pin picker feedback', () => {
  it('rotates the location icon while requesting the device position', () => {
    expect(source).toContain("const [isLocating, setIsLocating] = useState(false)");
    expect(source).toContain("isLocating ? 'motion-safe:animate-spin' : ''");
    expect(source).toContain('disabled={isLocating}');
    expect(source).toContain('setIsLocating(false)');
  });
});

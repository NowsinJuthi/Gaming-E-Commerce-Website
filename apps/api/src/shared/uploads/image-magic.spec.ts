import { isRasterImageMagic } from './image-magic';

describe('isRasterImageMagic', () => {
  it('accepts JPEG, PNG, GIF, and WebP prefixes', () => {
    expect(isRasterImageMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(12)]))).toBe(
      true,
    );
    expect(
      isRasterImageMagic(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(8)]),
      ),
    ).toBe(true);
    expect(isRasterImageMagic(Buffer.from('GIF89a........'))).toBe(true);
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    expect(isRasterImageMagic(webp)).toBe(true);
  });

  it('rejects HTML and SVG polyglots', () => {
    expect(isRasterImageMagic(Buffer.from('<script>alert(1)</script>'))).toBe(
      false,
    );
    expect(isRasterImageMagic(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe(
      false,
    );
  });
});

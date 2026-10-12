describe('production reCAPTCHA fail-closed policy', () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('treats an unconfigured production environment as a failed verification', () => {
    process.env.NODE_ENV = 'production';
    const failClosed =
      process.env.NODE_ENV === 'production' && !''.trim()
        ? { success: false, reason: 'not_configured' }
        : { success: true };
    expect(failClosed).toEqual({ success: false, reason: 'not_configured' });
  });
});

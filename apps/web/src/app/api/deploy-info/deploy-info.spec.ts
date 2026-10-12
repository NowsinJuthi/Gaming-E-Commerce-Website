describe("deploy-info public payload", () => {
  it("exposes only a build id", () => {
    const publicBody = { ok: true, buildId: "abc" };
    expect(Object.keys(publicBody).sort()).toEqual(["buildId", "ok"]);
    expect(JSON.stringify(publicBody)).not.toMatch(
      /cwd|root|node|packageVersion|deployRoot|webCwd/i,
    );
  });
});

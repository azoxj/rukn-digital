export async function readFile(p) { throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" }); }
export async function stat(p) { throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" }); }
export default { readFile, stat };
